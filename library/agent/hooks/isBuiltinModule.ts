import * as mod from "module";

/**
 * Returns true if the module is a builtin module, otherwise false.
 * In old Node.js versions, it returns undefined, because the used function is not available.
 */
export function isBuiltinModule(moduleName: string) {
  // Added in Node.js v18.6.0, v16.17.0
  if (typeof mod.isBuiltin === "function") {
    return mod.isBuiltin(moduleName);
  }
  return undefined;
}
