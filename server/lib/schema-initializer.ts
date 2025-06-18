import { sql, eq } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  sqliteTable,
  text,
  integer as drizzleInteger,
} from "drizzle-orm/sqlite-core";
import type { AppSchema } from "../../convex/schema";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { type schema as appSchemaDefinition } from "../../convex/schema"; // For DB type

interface FieldDefinition {
  dbType: string; // Changed from zodType
  isNullable: boolean;
  // We might add defaultValue, specific dbType later if needed for more granular comparison
}

interface TableDefinition {
  [fieldName: string]: FieldDefinition;
}

interface SchemaSnapshot {
  [tableName: string]: TableDefinition;
}

/**
 * Generates a structured snapshot of the application schema for comparison.
 */
function generateSchemaSnapshot(currentAppSchema: AppSchema): string {
  const snapshot: SchemaSnapshot = {};

  for (const [tableName, drizzleTable] of Object.entries(currentAppSchema)) {
    // console.log(`Processing table: ${tableName}`, drizzleTable); // Debug log from previous step, can be kept or removed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columnsFromSymbol = (drizzleTable as any)[
      Symbol.for("drizzle:Columns")
    ] as Record<string, SQLiteColumn>;

    if (!columnsFromSymbol) {
      console.error(
        `Skipping table ${tableName} in generateSchemaSnapshot: Cannot find Symbol.for('drizzle:Columns'). DrizzleTable object:`,
        drizzleTable
      );
      continue;
    }
    snapshot[tableName] = {};
    const columns = columnsFromSymbol;
    for (const column of Object.values(columns)) {
      snapshot[tableName][column.name] = {
        dbType: column.getSQLType(),
        isNullable: !column.notNull,
      };
    }
  }
  const sortedSnapshot: SchemaSnapshot = {};
  Object.keys(snapshot)
    .sort()
    .forEach((tableName) => {
      sortedSnapshot[tableName] = {};
      Object.keys(snapshot[tableName])
        .sort()
        .forEach((fieldName) => {
          sortedSnapshot[tableName][fieldName] = snapshot[tableName][fieldName];
        });
    });

  return JSON.stringify(sortedSnapshot, null, 2);
}

/**
 * Creates database tables based on the provided Drizzle schema if they don't already exist.
 * This function is intended to be called when the schema is known to be new or matching the database.
 * It does not handle schema migrations or mismatches.
 */
async function createTablesFromSchema(
  db: BetterSQLite3Database<typeof appSchemaDefinition>,
  appSchema: AppSchema
) {
  console.log("Executing createTablesFromSchema...");
  try {
    for (const [tableName, drizzleTable] of Object.entries(appSchema)) {
      const tableExistsResult = await db.get<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${tableName}`
      );
      const tableExists = !!tableExistsResult;

      if (!tableExists) {
        console.log(`Creating table: ${tableName}`);

        const columnDefinitions: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const columns = (drizzleTable as any)[
          Symbol.for("drizzle:Columns")
        ] as Record<string, SQLiteColumn>;

        if (!columns) {
          console.error(
            `Error creating table ${tableName}: Cannot find Symbol.for('drizzle:Columns'). DrizzleTable object:`,
            drizzleTable
          );
          continue;
        }

        for (const column of Object.values(columns)) {
          let colStr = `"${column.name}" ${column.getSQLType()}`;
          if (column.primary) {
            colStr += " PRIMARY KEY";
          }
          if (column.notNull) {
            colStr += " NOT NULL";
          }
          if (column.hasDefault) {
            const defaultValue = column.default;
            if (typeof defaultValue === "string") {
              colStr += ` DEFAULT '${defaultValue.replace(/'/g, "''")}'`;
            } else if (typeof defaultValue === "number") {
              colStr += ` DEFAULT ${defaultValue}`;
            } else if (typeof defaultValue === "boolean") {
              colStr += ` DEFAULT ${defaultValue ? 1 : 0}`;
            }
          }
          columnDefinitions.push(colStr);
        }

        const createTableQuery = sql.raw(
          `CREATE TABLE "${tableName}" (${columnDefinitions.join(", ")});`
        );
        await db.run(createTableQuery);
        console.log(`Table ${tableName} created.`);
      } else {
        console.log(
          `Table ${tableName} already exists (createTablesFromSchema).`
        );
      }
    }
    console.log("createTablesFromSchema execution complete.");
  } catch (error) {
    console.error("Error in createTablesFromSchema (outer):", error);
    throw error;
  }
}

const SCHEMA_META_TABLE_NAME = "_convex_schema_meta";
const SCHEMA_META_ROW_KEY = "current_schema";
const COMPACT_EMPTY_SCHEMA_SNAPSHOT = "{}";
const FORMATTED_EMPTY_SCHEMA_SNAPSHOT = JSON.stringify({}, null, 2);

const schemaMetaTableDrizzle = sqliteTable(SCHEMA_META_TABLE_NAME, {
  key: text("key").primaryKey(),
  schema_json_snapshot: text("schema_json_snapshot").notNull(),
  last_updated_at: drizzleInteger("last_updated_at").notNull(),
});

export async function ensureDatabaseSchemaIsUpToDate(
  db: BetterSQLite3Database<typeof appSchemaDefinition>,
  appSchema: AppSchema
) {
  console.log("Ensuring database schema is up to date...");

  const metaTableEntry = await db.get<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${SCHEMA_META_TABLE_NAME}`
  );
  const metaTableExists = !!metaTableEntry;

  if (!metaTableExists) {
    console.log(`Creating schema metadata table: ${SCHEMA_META_TABLE_NAME}`);
    const createMetaTableSQL = sql.raw(`
      CREATE TABLE ${SCHEMA_META_TABLE_NAME} (
        key TEXT PRIMARY KEY,
        schema_json_snapshot TEXT NOT NULL,
        last_updated_at INTEGER NOT NULL 
      );
    `);
    await db.run(createMetaTableSQL);
    console.log(`Schema metadata table ${SCHEMA_META_TABLE_NAME} created.`);
  }

  const currentSnapshotJson = generateSchemaSnapshot(appSchema);

  let storedSnapshotJson: string | undefined;
  const storedEntry = await db
    .select()
    .from(schemaMetaTableDrizzle)
    .where(eq(schemaMetaTableDrizzle.key, SCHEMA_META_ROW_KEY))
    .get();

  if (storedEntry) {
    storedSnapshotJson = storedEntry.schema_json_snapshot;
  }

  const isCurrentSnapshotEffectivelyEmpty =
    currentSnapshotJson === COMPACT_EMPTY_SCHEMA_SNAPSHOT ||
    currentSnapshotJson === FORMATTED_EMPTY_SCHEMA_SNAPSHOT;

  if (!storedSnapshotJson) {
    console.log(
      "No stored schema snapshot found. Initializing schema and storing snapshot."
    );
    try {
      await createTablesFromSchema(db, appSchema);
      await db.insert(schemaMetaTableDrizzle).values({
        key: SCHEMA_META_ROW_KEY,
        schema_json_snapshot: currentSnapshotJson,
        last_updated_at: Date.now(),
      });
      console.log("Database schema initialized and snapshot stored.");
    } catch (error) {
      console.error(
        "Error during initial schema creation or snapshot storage:",
        error
      );
      throw error;
    }
  } else if (storedSnapshotJson === currentSnapshotJson) {
    console.log("Database schema is up-to-date. No changes needed.");
  } else if (
    (storedSnapshotJson === COMPACT_EMPTY_SCHEMA_SNAPSHOT ||
      storedSnapshotJson === FORMATTED_EMPTY_SCHEMA_SNAPSHOT) &&
    !isCurrentSnapshotEffectivelyEmpty
  ) {
    console.log(
      "Stored schema snapshot is empty, current schema is populated. Initializing/updating schema and storing new snapshot."
    );
    try {
      await createTablesFromSchema(db, appSchema);
      await db
        .update(schemaMetaTableDrizzle)
        .set({
          schema_json_snapshot: currentSnapshotJson,
          last_updated_at: Date.now(),
        })
        .where(eq(schemaMetaTableDrizzle.key, SCHEMA_META_ROW_KEY));
      console.log(
        "Database schema (re)initialized from empty and new snapshot stored."
      );
    } catch (error) {
      console.error(
        "Error during schema (re)initialization from empty or snapshot update:",
        error
      );
      throw error;
    }
  } else {
    console.error("Database schema mismatch detected!");
    console.error("Stored snapshot:", storedSnapshotJson);
    console.error("Current snapshot:", currentSnapshotJson);
    throw new Error(
      `Database schema mismatch detected. The schema defined in convex/schema.ts has changed \\n` +
        `in a way that is incompatible with the existing database structure. \\n` +
        `Please manually migrate your data or clear the database using 'pnpm db:clear' \\n` +
        `and then restart the server.`
    );
  }
  console.log("ensureDatabaseSchemaIsUpToDate finished successfully.");
}
