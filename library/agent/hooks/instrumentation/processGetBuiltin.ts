import { removeNodePrefix } from "../../../helpers/removeNodePrefix";
import { __wrapBuiltinExports } from "./injectedFunctions";

let originalProcessGetBuiltinModule:
  | NodeJS.Process["getBuiltinModule"]
  | undefined;

export function patchProcessGetBuiltinModule() {
  if (typeof process.getBuiltinModule === "function") {
    originalProcessGetBuiltinModule = process.getBuiltinModule;

    // @ts-expect-error Types do not match
    process.getBuiltinModule = function getBuiltinModule(id: string) {
      return patchedGetBuiltinModule.call(this, id);
    };
  }
}

function patchedGetBuiltinModule(this: NodeJS.Process, id: string) {
  // Apply the original function
  const originalExports = originalProcessGetBuiltinModule!.call(this, id);

  if (typeof id !== "string") {
    return originalExports;
  }

  const builtinNameWithoutPrefix = removeNodePrefix(id);

  return __wrapBuiltinExports(builtinNameWithoutPrefix, originalExports);
}

export function getUnpatchedBuiltinModule(id: string) {
  if (originalProcessGetBuiltinModule) {
    return originalProcessGetBuiltinModule(id);
  }

  // Fallback
  return process.getBuiltinModule(id);
}
