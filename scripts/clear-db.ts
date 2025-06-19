import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "../dev.sqlite3");

async function clearDatabase() {
  try {
    await fs.unlink(dbPath);
    console.log(`Successfully deleted database file: ${dbPath}`);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(
        `Database file not found (already cleared or never existed): ${dbPath}`
      );
    } else {
      console.error(`Error deleting database file ${dbPath}:`, error);
      process.exit(1); // Exit with error code if deletion fails for other reasons
    }
  }
}

clearDatabase();
