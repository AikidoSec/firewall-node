import type { PackageInstrumentationInstruction } from "./types";
// eslint-disable-next-line camelcase
import { wasm_transform_code_str } from "./wasm/node_code_instrumentation";
import { getSourceType } from "./getSourceType";

export function transformCode(
  path: string,
  code: string,
  moduleName: string,
  isESM: boolean,
  fileInstructions: PackageInstrumentationInstruction["files"][0]
): string {
  const result = wasm_transform_code_str(
    code,
    moduleName,
    JSON.stringify(fileInstructions),
    getSourceType(path, isESM)
  );

  if (result.startsWith("#ERR:")) {
    throw new Error(`Error transforming code: ${result}`);
  }

  return result;
}
