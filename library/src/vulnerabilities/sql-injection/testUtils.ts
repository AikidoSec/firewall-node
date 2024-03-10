import { readFileSync } from "fs";

export function getLines(file: string) {
  const contents = readFileSync(file, "utf-8");

  return contents.split(/\r?\n/);
}
