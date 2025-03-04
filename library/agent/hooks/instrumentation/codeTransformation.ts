import type { PackageFileInstrumentationInstructionJSON } from "./types";
// eslint-disable-next-line camelcase
import { wasm_transform_code_str } from "./wasm/node_code_instrumentation";
import { getSourceType } from "./getSourceType";

// Todo check if caching is done by Node or if we need to cache the result

export function transformCode(
  path: string,
  code: string,
  isESM: boolean,
  fileInstructions: PackageFileInstrumentationInstructionJSON
): string {
  const result = wasm_transform_code_str(
    code,
    JSON.stringify(fileInstructions),
    getSourceType(path, isESM)
  );

  if (result.startsWith("#ERR:")) {
    throw new Error(`Error transforming code: ${result}`);
  }

  if (process.env.AIKIDO_UNIT_TEST !== "true") {
    return result;
  }

  // Rewrite import path for unit tests
  return result.replace(
    "@aikidosec/firewall/instrument/internals",
    "../../../../agent/hooks/instrumentation/injectedFunctions.ts"
  );
}
