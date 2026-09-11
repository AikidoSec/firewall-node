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

// Extensions from other platforms that a Node.js app wouldn't serve.
// Only treated as scanning when the status code is 404.
// A 200 might mean the app proxies to another backend.
const foreignExtensions = new Set<string>([
  "php",
  "php3",
  "php4",
  "php5",
  "phtml",
  "java",
  "jsp",
  "jspx",
]);

const filenames = new Set<string>(fileNames.map((name) => name.toLowerCase()));
const directories = new Set<string>(
  directoryNames.map((name) => name.toLowerCase())
);

export function isWebScanPath(path: string, statusCode: number): boolean {
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

      if (ext) {
        // Check file extension
        if (fileExtensions.has(ext)) {
          return true;
        }

        if (statusCode === 404 && foreignExtensions.has(ext)) {
          return true;
        }
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
