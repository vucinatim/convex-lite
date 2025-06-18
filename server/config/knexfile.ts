import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the configuration for Knex
const knexConfig = {
  development: {
    client: "sqlite3",
    connection: {
      filename: path.resolve(__dirname, "../../dev.sqlite3"),
    },
    useNullAsDefault: true, // Recommended for SQLite
    migrations: {
      directory: path.resolve(__dirname, "../../db/migrations"),
      tableName: "knex_migrations",
    },
    seeds: {
      directory: path.resolve(__dirname, "../../db/seeds"),
    },
  },
  // You can add other environments here like production, testing, etc.
};

export default knexConfig;
