import { removeNodePrefix } from "../../../helpers/removeNodePrefix";
import { wrapBuiltinExports } from "./wrapBuiltinExports";

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

  const builtinNameWithoutPrefix = removeNodePrefix(id);

  return wrapBuiltinExports(builtinNameWithoutPrefix, originalExports);
}

/**
 * Returns the module without applying any patches
 * If the patches are already applied, it will return the patched version!
 */
export function getBuiltinModuleWithoutPatching(id: string) {
  if (originalProcessGetBuiltinModule) {
    return originalProcessGetBuiltinModule(id);
  }

  // Fallback
  return process.getBuiltinModule(id);
}
