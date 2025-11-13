import type { PackageFileInstrumentationInstructionJSON } from "./types";
// eslint-disable-next-line camelcase
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
  // Path can be a RegExp pattern but JSON.stringify will throw an error
  // We want the actual file path anyway, not the matching pattern
  const instructionsWasm: JSONSerializable<PackageFileInstrumentationInstructionJSON> =
    {
      ...fileInstructions,
      path: path,
    };

  try {
    const result = wasm_transform_code_str(
      pkgName,
      pkgVersion,
      code,
      JSON.stringify(instructionsWasm),
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

// There's no nice way to create types like these
// Since we stringify the JSON instructions, we need to ensure that they are serializable
// e.g. cannot contain RegExp
type JSONPrimitive = string | number | boolean | null;
type JSONSerializable<T> = T extends JSONPrimitive
  ? T
  : T extends (infer U)[]
    ? JSONSerializable<U>[]
    : T extends Record<string, unknown>
      ? {
          [K in keyof T as T[K] extends Function | symbol | undefined
            ? never
            : K]: JSONSerializable<T[K]>;
        }
      : never;
