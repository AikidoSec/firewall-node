import { directoryNames } from "./paths/directoryNames";
import { fileNames } from "./paths/fileNames";

const fileExtensions = new Set<string>([
  "env",
  "bak",
  "sql",
  "sqlite",
  "sqlite3",
  "db",
  "old",
  "save",
  "orig",
  "sqlitedb",
  "sqlite3db",
]);

const filenames = new Set<string>(fileNames.map((name) => name.toLowerCase()));
const directories = new Set<string>(
  directoryNames.map((name) => name.toLowerCase())
);

export function isWebScanPath(path: string): boolean {
  const normalized = path.toLowerCase();

  const segments = normalized.split("/");
  const filename = segments.pop();

  if (filename) {
    // Check file name
    if (filenames.has(filename)) {
      return true;
    }

    if (filename.includes(".")) {
      const ext = filename.split(".").pop();

      // Check file extension
      if (ext && fileExtensions.has(ext)) {
        return true;
      }
    }
  }

  // Check all directory names
  for (const dir of segments) {
    if (directories.has(dir)) {
      return true;
    }
  }

  return false;
}
