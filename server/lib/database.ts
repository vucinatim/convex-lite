import knex from "knex";
import knexConfig from "../config/knexfile.ts"; // Added .ts extension

// Initialize Knex with the development configuration
const db = knex(knexConfig.development);

// Optional: Test the connection (useful during initial setup)
// db.raw('SELECT 1')
//   .then(() => {
//     console.log('SQLite connected successfully!');
//   })
//   .catch((e) => {
//     console.error('Failed to connect to SQLite:', e);
//     process.exit(1); // Exit if DB connection fails, as it's critical
//   });

export default db;
