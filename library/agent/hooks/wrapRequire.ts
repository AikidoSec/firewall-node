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
import { WrapPackageInfo } from "./WrapPackageInfo";
import { getInstance } from "../AgentSingleton";

const originalRequire = mod.prototype?.require;
let isRequireWrapped = false;

let packages: Package[] = [];
let builtinModules: BuiltinModule[] = [];
let pkgCache = new Map<string, unknown>();
let builtinCache = new Map<string, unknown>();

/**
 * Wraps the require function to intercept require calls.
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
 * Our custom require function that intercepts require calls.
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
    // Check if it's a builtin module
    // They are easier to patch (no file patching)
    // Separate handling for builtin modules improves the performance
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

  getInstance()?.onBuiltinWrapped(moduleName);

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
  const versionedPackagesToInstrument = packages
    .filter((pkg) => pkg.getName() === moduleName)
    .map((pkg) => pkg.getVersions())
    .flat();

  // Read the package.json of the required package
  let packageJson: PackageJson | undefined;
  try {
    packageJson = originalRequire(
      `${pathInfo.base}/package.json`
    ) as PackageJson;
  } catch {
    return originalExports;
  }

  // Get the version of the installed package
  const installedPkgVersion = packageJson.version;
  if (!installedPkgVersion) {
    throw new Error(
      `Could not get installed package version for ${moduleName}`
    );
  }

  const agent = getInstance();
  agent?.onPackageRequired(moduleName, installedPkgVersion);

  // We don't want to patch this package because we do not have any hooks for it
  if (!versionedPackagesToInstrument.length) {
    return originalExports;
  }

  // Check if the installed package version is supported (get all matching versioned packages)
  const matchingVersionedPackages = versionedPackagesToInstrument.filter(
    (pkg) => satisfiesVersion(pkg.getRange(), installedPkgVersion)
  );

  // Report to the agent that the package was wrapped or not if it's version is not supported
  agent?.onPackageWrapped(moduleName, {
    version: installedPkgVersion,
    supported: !!matchingVersionedPackages.length,
  });

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
    // If it's not the main file, we want to check if the want to patch the required file
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
 * Executes the provided require interceptor functions and sets the cache.
 */
function executeInterceptors(
  interceptors: RequireInterceptor[],
  exports: unknown,
  cache: Map<string, unknown>,
  cacheKey: string,
  wrapPackageInfo: WrapPackageInfo
) {
  // Cache because we need to prevent this called again if module is imported inside interceptors
  cache.set(cacheKey, exports);

  // Return early if no interceptors
  if (!interceptors.length) {
    return exports;
  }

  // Foreach interceptor function
  for (const interceptor of interceptors) {
    // If one interceptor fails, we don't want to stop the other interceptors
    try {
      const returnVal = interceptor(exports, wrapPackageInfo);
      // If the interceptor returns a value, we want to use this value as the new exports
      if (returnVal !== undefined) {
        exports = returnVal;
      }
    } catch (error) {
      if (error instanceof Error) {
        getInstance()?.onFailedToWrapModule(wrapPackageInfo.name, error);
      }
    }
  }

  // Finally cache the result
  cache.set(cacheKey, exports);

  return exports;
}

/**
 * Returns the unwrapped require function.
 */
export function getOriginalRequire() {
  return originalRequire;
}

// In order to support multiple versions of the same package, we need to rewrite the package name
// e.g. In our sources and sinks, we use the real package name `hooks.addPackage("undici")`
// but in the tests we want to `require("undici-v6")` instead of `require("undici")`
export function __internalRewritePackageName(
  packageName: string,
  aliasForTesting: string
) {
  if (!isRequireWrapped) {
    throw new Error(
      "Start the agent before calling __internalRewritePackageName(..)"
    );
  }

  if (packages.length === 0) {
    throw new Error("No packages to patch");
  }

  const pkg = packages.find((pkg) => pkg.getName() === packageName);

  if (!pkg) {
    throw new Error(`Could not find package ${packageName}`);
  }

  pkg.setName(aliasForTesting);
}
