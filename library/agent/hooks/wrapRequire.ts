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

let originalRequire = mod.prototype.require;
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
  isRequireWrapped = true;

  // @ts-expect-error TS doesn't know that we are not overwriting the subproperties
  mod.prototype.require = function wrapped() {
    // eslint-disable-next-line prefer-rest-params
    return patchedRequire.call(this, arguments);
  };

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
      return patchBuiltinModule.call(this, id, originalExports);
    }

    return patchPackage.call(this as mod, id, originalExports);
  } catch (error) {
    // Todo handle (logger)
    console.error(error);
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

  const matchingBuiltins = builtinModules.filter(
    (m) => m.getName() === moduleName
  );

  // We don't want to patch this builtin module
  if (!matchingBuiltins.length) {
    return originalExports;
  }

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
 * Checks package versions.
 */
function patchPackage(this: mod, id: string, originalExports: unknown) {
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

  const versionedPackages = packages
    .filter((pkg) => pkg.getName() === moduleName)
    .map((pkg) => pkg.getVersions())
    .flat();

  // We don't want to patch this package
  if (!versionedPackages.length) {
    return originalExports;
  }

  const packageJson = originalRequire(
    `${pathInfo.base}/package.json`
  ) as PackageJson;

  const installedPkgVersion = packageJson.version;
  if (!installedPkgVersion) {
    throw new Error(
      `Could not get installed package version for ${moduleName}`
    );
  }

  const agent = getInstance();

  const matchingVersionedPackages = versionedPackages.filter((pkg) =>
    satisfiesVersion(pkg.getRange(), installedPkgVersion)
  );

  if (agent) {
    agent.onPackageWrapped(moduleName, {
      version: installedPkgVersion,
      supported: !!matchingVersionedPackages.length,
    });
  }

  if (!matchingVersionedPackages.length) {
    // We don't want to patch this package version
    return originalExports;
  }

  const isMainFile = isMainJsFile(pathInfo, id, filename, packageJson);

  let interceptors: RequireInterceptor[] = [];

  if (isMainFile) {
    interceptors = matchingVersionedPackages
      .map((pkg) => pkg.getRequireInterceptors())
      .flat();
  } else {
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
      if (typeof returnVal !== "undefined") {
        exports = returnVal;
      }
    } catch (error) {
      // Todo handle (logger)
      console.error(error);
    }
  }

  cache.set(cacheKey, exports);

  return exports;
}

export function getOrignalRequire() {
  return originalRequire;
}
