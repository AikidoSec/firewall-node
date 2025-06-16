import type { PackageFileInstrumentationInstructionJSON } from "./types";
// eslint-disable-next-line camelcase
import { wasm_transform_code_str } from "./wasm/node_code_instrumentation";
import { getSourceType, PackageLoadFormat } from "./getSourceType";
import { join } from "path";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";

export function transformCode(
  pkgName: string,
  pkgVersion: string,
  path: string,
  code: string,
  pkgLoadFormat: PackageLoadFormat,
  fileInstructions: PackageFileInstrumentationInstructionJSON
): string {
  const result = wasm_transform_code_str(
    pkgName,
    pkgVersion,
    code,
    JSON.stringify(fileInstructions),
    getSourceType(path, pkgLoadFormat)
  );

  if (result.startsWith("#ERR:")) {
    throw new Error(`Error transforming code: ${result}`);
  }

  // Rewrite import path for unit tests if environment variable is set to true
  if (isNewInstrumentationUnitTest()) {
    return result.replace(
      "@aikidosec/firewall/instrument/internals",
      join(__dirname, "injectedFunctions.ts")
    );
  }

  return result;
}
