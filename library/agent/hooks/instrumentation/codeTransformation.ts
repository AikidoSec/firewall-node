import type { PackageFileInstrumentationInstructionJSON } from "./types";
// eslint-disable-next-line camelcase
import { wasm_transform_code_str } from "./wasm/node_code_instrumentation";
import { getSourceType, PackageLoadFormat } from "./getSourceType";
import { join } from "path";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";
import { envToBool } from "../../../helpers/envToBool";

export function transformCode(
  pkgName: string,
  pkgVersion: string,
  path: string,
  code: string,
  pkgLoadFormat: PackageLoadFormat,
  fileInstructions: PackageFileInstrumentationInstructionJSON
): string {
  try {
    const result = wasm_transform_code_str(
      pkgName,
      pkgVersion,
      code,
      JSON.stringify(fileInstructions),
      getSourceType(path, pkgLoadFormat)
    );

    // Rewrite import path for unit tests if environment variable is set to true
    if (isNewInstrumentationUnitTest()) {
      return result.replace(
        "@aikidosec/firewall/instrument/internals",
        join(
          __dirname,
          envToBool(process.env.AIKIDO_ESM_TEST)
            ? "injectedFunctions.js"
            : "injectedFunctions.ts"
        )
      );
    }

    return result;
  } catch (error) {
    // Convert string errors to Error objects
    if (typeof error === "string") {
      throw new Error(`Error transforming code: ${error}`);
    }
    throw error;
  }
}
