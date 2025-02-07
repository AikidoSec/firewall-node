import { resolve } from "path";

const libraryRoot = resolve(__dirname, "..");

export function getLibraryRoot(): string {
  return libraryRoot;
}
