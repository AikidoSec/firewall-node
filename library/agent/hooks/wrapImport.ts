/* eslint-disable max-lines-per-function */
import { register } from "module";
import { pathToFileURL } from "url";
import { Hook } from "import-in-the-middle";
import { BuiltinModule } from "./BuiltinModule";
import { Package } from "./Package";

let isImportHookRegistered = false;

let packages: Package[] = [];
let builtinModules: BuiltinModule[] = [];
let pkgCache = new Map<string, unknown>();
let builtinCache = new Map<string, unknown>();

/**
 * Intercept esm package imports.
 * This function makes sure that the import function is only wrapped once.
 */
export function wrapImport() {
  if (isImportHookRegistered) {
    return;
  }

  // Prevent registering the import hook multiple times
  isImportHookRegistered = true;

  // Register import-in-the-middle hook
  register("import-in-the-middle/hook.mjs", pathToFileURL(__filename));

  const allPackageNames = [packages, builtinModules]
    .flat()
    .map((p) => p.getName());

  new Hook(
    allPackageNames,
    {
      internals: true,
    },
    (exports, name, baseDir) => {
      // Todo ...
      //console.log(name);
      //console.log(baseDir);
      //console.log(process.pid);
    }
  );
}

/**
 * Update the list of external packages that should be patched.
 */
export function setImportPackagesToPatch(packagesToPatch: Package[]) {
  packages = packagesToPatch;
  // Reset cache
  pkgCache = new Map();
}

/**
 * Update the list of builtin modules that should be patched.
 */
export function setImportBuiltinModulesToPatch(
  builtinModulesToPatch: BuiltinModule[]
) {
  builtinModules = builtinModulesToPatch;
  // Reset cache
  builtinCache = new Map();
}
