import { readFileSync } from "node:fs";

export function looksLikeModuleSyntax(path: string): boolean {
  const fileContent = readFileSync(path, "utf-8");

  const hasImportExport = /(^\s*import\s.+\sfrom\s.+)|(^\s*export\s.+)/m.test(
    fileContent
  );

  return hasImportExport;
}
