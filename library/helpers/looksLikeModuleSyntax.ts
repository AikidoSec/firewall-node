import { getBuiltinModuleWithoutPatching } from "../agent/hooks/instrumentation/processGetBuiltin";

export async function looksLikeModuleSyntax(path: string): Promise<boolean> {
  const { readFile } = getBuiltinModuleWithoutPatching(
    "fs/promises"
  ) as typeof import("fs/promises");

  const fileContent = await readFile(path, "utf-8");

  const hasImportExport = /(^\s*import\s.+\sfrom\s.+)|(^\s*export\s.+)/m.test(
    fileContent
  );

  return hasImportExport;
}
