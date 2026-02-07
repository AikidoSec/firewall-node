import { wasm_transform_user_code } from "./wasm/node_code_instrumentation";
import { getSourceType, PackageLoadFormat } from "./getSourceType";
import { join } from "path";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";
import { isEsmUnitTest } from "../../../helpers/isEsmUnitTest";

export function transformUserCode(
  path: string,
  code: string,
  loadFormat: PackageLoadFormat
): string | undefined {
  try {
    const result = wasm_transform_user_code(
      code,
      getSourceType(path, loadFormat)
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
  } catch {
    // Don't break user code loading if transformation fails
    return undefined;
  }
}
