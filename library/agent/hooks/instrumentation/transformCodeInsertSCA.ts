// eslint-disable-next-line camelcase
import { wasm_transform_code_str_insert_sca } from "./wasm/node_code_instrumentation";
import { getSourceType, PackageLoadFormat } from "./getSourceType";
import { join } from "path";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";
import { isEsmUnitTest } from "../../../helpers/isEsmUnitTest";

export function transformCodeInsertSCA(
  pkgName: string,
  pkgVersion: string,
  agentVersion: string,
  path: string,
  code: string,
  pkgLoadFormat: PackageLoadFormat
): string {
  try {
    const result = wasm_transform_code_str_insert_sca(
      pkgName,
      pkgVersion,
      agentVersion,
      code,
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
