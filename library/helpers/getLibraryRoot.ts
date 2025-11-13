import { sep, resolve } from "path";

const isBundled = !__filename.includes(`${sep}helpers${sep}getLibraryRoot`);

const libraryRoot = resolve(__dirname, isBundled ? "." : "..");

export function getLibraryRoot(): string {
  return libraryRoot;
}
