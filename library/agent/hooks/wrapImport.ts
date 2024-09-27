/* eslint-disable max-lines-per-function */
import { register } from "module";
import { pathToFileURL } from "url";
import { Hook } from "import-in-the-middle";
import { BuiltinModule } from "./BuiltinModule";
import { Package } from "./Package";
import { isBuiltinModule } from "./isBuiltinModule";
import { getInstance } from "../AgentSingleton";
import { removeNodePrefix } from "../../helpers/removeNodePrefix";
import { RequireInterceptor } from "./RequireInterceptor";
import { WrapPackageInfo } from "./WrapPackageInfo";

let isImportHookRegistered = false;

let packages: Package[] = [];
let builtinModules: BuiltinModule[] = [];

/**
 * Intercept esm package imports.
 * This function makes sure that the import function is only wrapped once.
 */
export function wrapImport(
  packagesToPatch: Package[],
  builtinModulesToPatch: BuiltinModule[]
) {
  if (isImportHookRegistered) {
    return;
  }
  packages = packagesToPatch;
  builtinModules = builtinModulesToPatch;

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
    onImport
  );
}

/**
 * This function is called when a package / file of a package is imported for the first time.
 */
function onImport(exports: any, name: string, baseDir: string | void) {
  try {
    // Check if its a builtin module
    // They are easier to patch (no file patching)
    if (isBuiltinModule(name)) {
      patchBuiltinModule(exports, name);
      return;
    }

    patchPackage(exports, name, baseDir);
  } catch (error) {
    if (error instanceof Error) {
      getInstance()?.onFailedToWrapModule(name, error);
    }
  }
}

function patchBuiltinModule(exports: any, name: string) {
  const moduleName = removeNodePrefix(name);

  // Check if we want to patch this builtin module
  const matchingBuiltins = builtinModules.filter(
    (m) => m.getName() === moduleName
  );

  // Get interceptors from all matching builtin modules
  const interceptors = matchingBuiltins
    .map((m) => m.getRequireInterceptors())
    .flat();

  executeInterceptors(interceptors, exports, {
    name: moduleName,
    type: "builtin",
  });
}

function patchPackage(exports: any, name: string, baseDir: string | void) {
  // Todo
}

/**
 * Executes the provided require interceptor functions
 */
function executeInterceptors(
  interceptors: RequireInterceptor[],
  exports: unknown,
  wrapPackageInfo: WrapPackageInfo
) {
  // Return early if no interceptors
  if (!interceptors.length) {
    return;
  }

  // Foreach interceptor function
  for (const interceptor of interceptors) {
    // If one interceptor fails, we don't want to stop the other interceptors
    try {
      const returnVal = interceptor(exports, wrapPackageInfo);
      // If the interceptor returns a value, we want to use this value as the new exports
      if (typeof returnVal !== "undefined") {
        exports = returnVal;
      }
    } catch (error) {
      if (error instanceof Error) {
        getInstance()?.onFailedToWrapModule(wrapPackageInfo.name, error);
      }
    }
  }
}
