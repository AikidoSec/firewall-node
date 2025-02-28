import type { PackageFileInstrumentationInstructionJSON } from "./types";
// eslint-disable-next-line camelcase
import { wasm_transform_code_str } from "./wasm/node_code_instrumentation";
import { getSourceType } from "./getSourceType";

// Todo check if caching is done by Node or if we need to cache the result

export function transformCode(
  path: string,
  code: string,
  moduleName: string,
  isESM: boolean,
  fileInstructions: PackageFileInstrumentationInstructionJSON
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
