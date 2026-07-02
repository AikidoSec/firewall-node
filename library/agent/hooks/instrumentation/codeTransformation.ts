import type { PackageFileInstrumentationInstructionJSON } from "./types";
import { wasm_transform_code_str } from "./wasm/node_code_instrumentation";
import { getSourceType, PackageLoadFormat } from "./getSourceType";
import { join } from "path";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";
import { isEsmUnitTest } from "../../../helpers/isEsmUnitTest";

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
      // ESM files generate static ESM import statements, but ts-node can't handle this
      // Use a .mjs wrapper (which uses createRequire internally) for ESM files
      const injectedFile = isEsmUnitTest()
        ? "injectedFunctions.js"
        : pkgLoadFormat === "module"
          ? "injectedFunctions.mjs"
          : "injectedFunctions.ts";
      return result.replace(
        "@aikidosec/firewall/instrument/internals",
        join(__dirname, injectedFile)
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
