import { sql, eq } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import {
  sqliteTable,
  text,
  integer as drizzleInteger,
} from "drizzle-orm/sqlite-core";
import type { AppSchema } from "../../convex/_schema";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { type schema as appSchemaDefinition } from "../../convex/_schema";

// THE FIX - Step 1: Declare the symbol as a constant.
const drizzleColumnsSymbol = Symbol.for("drizzle:Columns");

// A helper type for a Drizzle table that is guaranteed to have the internal symbol.
type DrizzleTableWithColumns = SQLiteTable & {
  [drizzleColumnsSymbol]: Record<string, SQLiteColumn>;
};

// Helper function to check if an object is a Drizzle table
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isDrizzleTable(obj: any): obj is DrizzleTableWithColumns {
  return obj && typeof obj === "object" && drizzleColumnsSymbol in obj;
}

interface FieldDefinition {
  dbType: string;
  isNullable: boolean;
}

interface TableDefinition {
  [fieldName: string]: FieldDefinition;
}

interface SchemaSnapshot {
  [tableName: string]: TableDefinition;
}

function generateSchemaSnapshot(currentAppSchema: AppSchema): string {
  const snapshot: SchemaSnapshot = {};

  for (const [tableName, tableOrRelation] of Object.entries(currentAppSchema)) {
    // Check if the property is a valid Drizzle table.
    if (!isDrizzleTable(tableOrRelation)) {
      console.log(
        `Skipping non-table property in schema snapshot: ${tableName}`
      );
      continue;
    }

    // THE FIX - Step 2: Use the constant to access the property.
    // The type guard `isDrizzleTable` now makes this access type-safe.
    const columns = tableOrRelation[drizzleColumnsSymbol];
    snapshot[tableName] = {};

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

async function createTablesFromSchema(
  db: BetterSQLite3Database<typeof appSchemaDefinition>,
  appSchema: AppSchema
) {
  console.log("Executing createTablesFromSchema...");
  try {
    for (const [tableName, tableOrRelation] of Object.entries(appSchema)) {
      // Check if the property is a valid Drizzle table.
      if (!isDrizzleTable(tableOrRelation)) {
        console.log(
          `Skipping non-table property in table creation: ${tableName}`
        );
        continue;
      }

      const drizzleTable = tableOrRelation;
      const tableExistsResult = await db.get<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${tableName}`
      );
      const tableExists = !!tableExistsResult;

      if (!tableExists) {
        console.log(`Creating table: ${tableName}`);
        // THE FIX - Step 3: Use the constant here as well.
        const columns = drizzleTable[drizzleColumnsSymbol];
        const columnDefinitions: string[] = [];

        for (const column of Object.values(columns)) {
          let colStr = `"${column.name}" ${column.getSQLType()}`;
          if (column.primary) colStr += " PRIMARY KEY";
          if (column.notNull) colStr += " NOT NULL";
          if (column.hasDefault) {
            const defaultValue = column.default;
            if (typeof defaultValue === "string") {
              colStr += ` DEFAULT '${defaultValue.replace(/'/g, "''")}'`;
            } else {
              colStr += ` DEFAULT ${defaultValue}`;
            }
          }
          columnDefinitions.push(colStr);
        }

        const createTableQuery = sql.raw(
          `CREATE TABLE "${tableName}" (${columnDefinitions.join(", ")});`
        );
        await db.run(createTableQuery);
        console.log(`Table ${tableName} created.`);
      }
    }
    console.log("createTablesFromSchema execution complete.");
  } catch (error) {
    console.error("Error in createTablesFromSchema:", error);
    throw error;
  }
}

const SCHEMA_META_TABLE_NAME = "_convex_schema_meta";
const SCHEMA_META_ROW_KEY = "current_schema";

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

  if (!metaTableEntry) {
    console.log(`Creating schema metadata table: ${SCHEMA_META_TABLE_NAME}`);
    const createMetaTableSQL = sql.raw(`
      CREATE TABLE ${SCHEMA_META_TABLE_NAME} (
        key TEXT PRIMARY KEY,
        schema_json_snapshot TEXT NOT NULL,
        last_updated_at INTEGER NOT NULL 
      );
    `);
    await db.run(createMetaTableSQL);
    console.log(`Schema metadata table created.`);
  }

  const currentSnapshotJson = generateSchemaSnapshot(appSchema);

  const storedEntry = await db
    .select()
    .from(schemaMetaTableDrizzle)
    .where(eq(schemaMetaTableDrizzle.key, SCHEMA_META_ROW_KEY))
    .get();

  const storedSnapshotJson = storedEntry?.schema_json_snapshot;

  if (!storedSnapshotJson) {
    console.log("No stored schema snapshot found. Initializing schema...");
    await createTablesFromSchema(db, appSchema);
    await db.insert(schemaMetaTableDrizzle).values({
      key: SCHEMA_META_ROW_KEY,
      schema_json_snapshot: currentSnapshotJson,
      last_updated_at: Date.now(),
    });
    console.log("Database schema initialized and snapshot stored.");
  } else if (storedSnapshotJson === currentSnapshotJson) {
    console.log("Database schema is up-to-date.");
  } else {
    console.error("Database schema mismatch detected!");
    console.error("Stored snapshot:", storedSnapshotJson);
    console.error("Current snapshot:", currentSnapshotJson);
    throw new Error(
      `Database schema mismatch. Please manually migrate or clear the database ('pnpm db:clear') and restart the server.`
    );
  }
  console.log("ensureDatabaseSchemaIsUpToDate finished successfully.");
}
