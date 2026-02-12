import { readFile } from "fs/promises";

export async function looksLikeModuleSyntax(path: string): Promise<boolean> {
  const fileContent = await readFile(path, "utf-8");

  const hasImportExport = /(^\s*import\s.+\sfrom\s.+)|(^\s*export\s.+)/m.test(
    fileContent
  );

  return hasImportExport;
}
