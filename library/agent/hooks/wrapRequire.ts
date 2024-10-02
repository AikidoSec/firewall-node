/* eslint-disable max-lines-per-function */
import * as mod from "module";
import { BuiltinModule } from "./BuiltinModule";
import { isBuiltinModule } from "./isBuiltinModule";
import { getModuleInfoFromPath } from "./getModuleInfoFromPath";
import { Package } from "./Package";
import { satisfiesVersion } from "../../helpers/satisfiesVersion";
import { removeNodePrefix } from "../../helpers/removeNodePrefix";
import { RequireInterceptor } from "./RequireInterceptor";
import type { PackageJson } from "type-fest";
import { isMainJsFile } from "./isMainJsFile";
import { getInstance } from "../AgentSingleton";
import { executeInterceptors } from "./executeInterceptors";

let originalRequire: typeof mod.prototype.require;
let isRequireWrapped = false;

let packages: Package[] = [];
let builtinModules: BuiltinModule[] = [];
let pkgCache = new Map<string, unknown>();
let builtinCache = new Map<string, unknown>();

/**
 * Wraps the require function to intercept the require calls.
 * This function makes sure that the require function is only wrapped once.
 */
export function wrapRequire() {
  if (isRequireWrapped) {
    return;
  }
  // @ts-expect-error Not included in the Node.js types
  if (typeof mod._resolveFilename !== "function") {
    throw new Error(
      `Could not find the _resolveFilename function in node:module using Node.js version ${process.version}`
    );
  }

  // Prevent wrapping the require function multiple times
  isRequireWrapped = true;
  // Save the original require function
  originalRequire = mod.prototype.require;

  // @ts-expect-error TS doesn't know that we are not overwriting the subproperties
  mod.prototype.require = function wrapped() {
    // eslint-disable-next-line prefer-rest-params
    return patchedRequire.call(this, arguments);
  };

  // Wrap process.getBuiltinModule, which allows requiring builtin modules (since Node.js v22.3.0)
  if (typeof process.getBuiltinModule === "function") {
    process.getBuiltinModule = function wrappedGetBuiltinModule() {
      // eslint-disable-next-line prefer-rest-params
      return patchedRequire.call(this, arguments);
    };
  }
}

/**
 * Update the list of external packages that should be patched.
 */
export function setPackagesToPatch(packagesToPatch: Package[]) {
  packages = packagesToPatch;
  // Reset cache
  pkgCache = new Map();
}

/**
 * Update the list of builtin modules that should be patched.
 */
export function setBuiltinModulesToPatch(
  builtinModulesToPatch: BuiltinModule[]
) {
  builtinModules = builtinModulesToPatch;
  // Reset cache
  builtinCache = new Map();
}

/**
 * Our custom require function that intercepts the require calls.
 */
function patchedRequire(this: mod | NodeJS.Process, args: IArguments) {
  // Apply the original require function
  const originalExports = originalRequire.apply(
    this,
    args as unknown as [string]
  );

  if (!args.length || typeof args[0] !== "string") {
    return originalExports;
  }

  /**
   * Parameter that is passed to the require function
   * Can be a module name, a relative / absolute path
   */
  const id = args[0] as string;

  try {
    // Check if its a builtin module
    // They are easier to patch (no file patching)
    // Seperate handling for builtin modules improves the performance
    if (isBuiltinModule(id)) {
      // Call function for patching builtin modules with the same context (this)
      return patchBuiltinModule.call(this, id, originalExports);
    }

    // Call function for patching external packages
    return patchPackage.call(this as mod, id, originalExports);
  } catch (error) {
    if (error instanceof Error) {
      getInstance()?.onFailedToWrapModule(id, error);
    }
    return originalExports;
  }
}

/**
 * Run all require interceptors for the builtin module and cache the result.
 */
function patchBuiltinModule(id: string, originalExports: unknown) {
  const moduleName = removeNodePrefix(id);

  // Check if already cached
  if (builtinCache.has(moduleName)) {
    return builtinCache.get(moduleName);
  }

  // Check if we want to patch this builtin module
  const matchingBuiltins = builtinModules.filter(
    (m) => m.getName() === moduleName
  );

  // We don't want to patch this builtin module
  if (!matchingBuiltins.length) {
    return originalExports;
  }

  // Get interceptors from all matching builtin modules
  const interceptors = matchingBuiltins
    .map((m) => m.getRequireInterceptors())
    .flat();

  return executeInterceptors(
    interceptors,
    originalExports,
    builtinCache,
    moduleName,
    {
      name: moduleName,
      type: "builtin",
    }
  );
}

/**
 * Run all require interceptors for the package and cache the result.
 * Also checks the package versions. Not used for builtin modules.
 */
function patchPackage(this: mod, id: string, originalExports: unknown) {
  // Get the full filepath of the required js file
  // @ts-expect-error Not included in the Node.js types
  const filename = mod._resolveFilename(id, this);
  if (!filename) {
    throw new Error("Could not resolve filename using _resolveFilename");
  }

  // Ignore .json files
  if (filename.endsWith(".json")) {
    return originalExports;
  }

  // Check if cache has the filename
  if (pkgCache.has(filename)) {
    return pkgCache.get(filename);
  }

  // Parses the filename to extract the module name, the base dir of the module and the relative path of the included file
  const pathInfo = getModuleInfoFromPath(filename);
  if (!pathInfo) {
    // Can happen if the package is not inside a node_modules folder, like the dev build of our library itself
    return originalExports;
  }
  const moduleName = pathInfo.name;

  // Get all versioned packages for the module name
  const versionedPackages = packages
    .filter((pkg) => pkg.getName() === moduleName)
    .map((pkg) => pkg.getVersions())
    .flat();

  // We don't want to patch this package because we do not have any hooks for it
  if (!versionedPackages.length) {
    return originalExports;
  }

  // Read the package.json of the required package
  const packageJson = originalRequire(
    `${pathInfo.base}/package.json`
  ) as PackageJson;

  // Get the version of the installed package
  const installedPkgVersion = packageJson.version;
  if (!installedPkgVersion) {
    throw new Error(
      `Could not get installed package version for ${moduleName}`
    );
  }

  // Check if the installed package version is supported (get all matching versioned packages)
  const matchingVersionedPackages = versionedPackages.filter((pkg) =>
    satisfiesVersion(pkg.getRange(), installedPkgVersion)
  );

  const agent = getInstance();
  if (agent) {
    // Report to the agent that the package was wrapped or not if it's version is not supported
    agent.onPackageWrapped(moduleName, {
      version: installedPkgVersion,
      supported: !!matchingVersionedPackages.length,
    });
  }

  if (!matchingVersionedPackages.length) {
    // We don't want to patch this package version
    return originalExports;
  }

  // Check if the required file is the main file of the package or another js file inside the package
  const isMainFile = isMainJsFile(pathInfo, id, filename, packageJson);

  let interceptors: RequireInterceptor[] = [];

  if (isMainFile) {
    interceptors = matchingVersionedPackages
      .map((pkg) => pkg.getRequireInterceptors())
      .flat();
  } else {
    // If its not the main file, we want to check if the want to patch the required file
    interceptors = matchingVersionedPackages
      .map((pkg) => pkg.getRequireFileInterceptor(pathInfo.path) || [])
      .flat();
  }

  return executeInterceptors(
    interceptors,
    originalExports,
    pkgCache,
    filename as string,
    {
      name: pathInfo.name,
      version: installedPkgVersion,
      type: "external",
      path: {
        base: pathInfo.base,
        relative: pathInfo.path,
      },
    }
  );
}

/**
 * Returns the unwrapped require function.
 */
export function getOrignalRequire() {
  return originalRequire || mod.prototype?.require;
}
