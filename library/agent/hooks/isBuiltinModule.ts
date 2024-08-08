import * as mod from "module";

// Added in Node.js v9.3.0, v8.10.0, v6.13.0
const moduleList = mod.builtinModules;

/**
 * Returns true if the module is a builtin module, otherwise false.
 */
export function isBuiltinModule(moduleName: string) {
  // Added in Node.js v18.6.0, v16.17.0
  if (typeof mod.isBuiltin === "function") {
    return mod.isBuiltin(moduleName);
  }

  return moduleList.includes(moduleName);
}
