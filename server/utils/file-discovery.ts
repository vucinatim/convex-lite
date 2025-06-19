import fs from "fs/promises";
import path from "path";

// --- Shared Configuration ---
export const CONVEX_DIR = path.resolve("convex");

const IGNORED_FILES = ["schema.ts", "server.ts"];
const IGNORED_DIRS = ["_generated", "lib"];

/**
 * Recursively finds all valid API source files within a directory,
 * respecting the ignore lists.
 * @param {string} dir - The directory to start scanning from.
 * @returns {AsyncGenerator<string>} An async generator that yields the full path of each valid file.
 */
export async function* getApiFiles(dir: string): AsyncGenerator<string> {
  try {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.resolve(dir, dirent.name);

      if (dirent.isDirectory()) {
        if (!IGNORED_DIRS.includes(dirent.name)) {
          yield* getApiFiles(fullPath);
        }
      } else {
        if (
          (fullPath.endsWith(".ts") || fullPath.endsWith(".js")) &&
          !IGNORED_FILES.includes(dirent.name)
        ) {
          yield fullPath;
        }
      }
    }
  } catch (error) {
    // Ignore errors for non-existent directories, which can happen during development.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Error reading directory ${dir}:`, error);
    }
  }
}
