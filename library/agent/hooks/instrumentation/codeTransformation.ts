import type { PackageFileInstrumentationInstructionJSON } from "./types";
// eslint-disable-next-line camelcase
import { wasm_transform_code_str } from "./wasm/node_code_instrumentation";
import { getSourceType, PackageLoadFormat } from "./getSourceType";
import { join } from "path";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";
import { isEsmUnitTest } from "../../../helpers/isEsmUnitTest";

// path can also be a RegExp, this results in an empty object when serialized to JSON
// serde will try to parse it and crash, so we need to set it to the actual file path
type PackageFileInstrumentationInstructionWASM = Omit<
  PackageFileInstrumentationInstructionJSON,
  "path"
> & { path: string };

export function transformCode(
  pkgName: string,
  pkgVersion: string,
  path: string,
  code: string,
  pkgLoadFormat: PackageLoadFormat,
  fileInstructions: PackageFileInstrumentationInstructionJSON
): string {
  let wasmInstructions: PackageFileInstrumentationInstructionWASM = {
    ...fileInstructions,
    path: path,
  };

  try {
    const result = wasm_transform_code_str(
      pkgName,
      pkgVersion,
      code,
      JSON.stringify(wasmInstructions),
      getSourceType(path, pkgLoadFormat)
    );

    // Rewrite import path for unit tests if environment variable is set to true
    if (isNewInstrumentationUnitTest()) {
      return result.replace(
        "@aikidosec/firewall/instrument/internals",
        join(
          __dirname,
          isEsmUnitTest() ? "injectedFunctions.js" : "injectedFunctions.ts"
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
