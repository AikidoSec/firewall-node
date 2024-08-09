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

const originalRequire = mod.prototype.require;
let isRequireWrapped = false;

/**
 * Todo
 * - process.getBuiltinModule
 * - https://nodejs.org/api/packages.html#package-entry-points
 */

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
    return patchedRequire.call(this, arguments);
  };
}

export function setPackagesToPatch(packagesToPatch: Package[]) {
  packages = packagesToPatch;
  // Reset cache
  pkgCache = new Map();
}

export function setBuiltinModulesToPatch(
  builtinModulesToPatch: BuiltinModule[]
) {
  builtinModules = builtinModulesToPatch;
  // Reset cache
  builtinCache = new Map();
}

function patchedRequire(this: mod, args: IArguments) {
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

    return patchPackage.call(this, id, originalExports);
  } catch (error) {
    // Todo handle (logger)
    console.error(error);
    return originalExports;
  }
}

function patchBuiltinModule(id: string, originalExports: unknown) {
  const moduleName = removeNodePrefix(id);

  if (builtinCache.has(moduleName)) {
    return builtinCache.get(moduleName);
  }

  const builtinModule = builtinModules.find((m) => m.getName() === moduleName);

  // We don't want to patch this builtin module
  if (!builtinModule) {
    return originalExports;
  }

  const interceptors = builtinModule.getRequireInterceptors();

  return executeInterceptors(
    interceptors,
    originalExports,
    builtinCache,
    moduleName
  );
}

function patchPackage(this: mod, id: string, originalExports: unknown) {
  // @ts-expect-error Not included in the Node.js types
  const filename = mod._resolveFilename(id, this);
  if (!filename) {
    throw new Error("Could not resolve filename using _resolveFilename");
  }

  if (pkgCache.has(filename)) {
    return pkgCache.get(filename);
  }

  const info = getModuleInfoFromPath(filename);
  if (!info) {
    throw new Error("Could not get module info from path");
  }
  const moduleName = info.name;

  const versionedPackages = packages
    .find((pkg) => pkg.getName() === moduleName)
    ?.getVersions();
  // We don't want to patch this package
  if (!versionedPackages) {
    return originalExports;
  }

  const packageJson = originalRequire(
    `${info.base}/package.json`
  ) as PackageJson;

  const installedPkgVersion = packageJson.version;
  if (!installedPkgVersion) {
    throw new Error(
      `Could not get installed package version for ${moduleName}`
    );
  }

  const matchingVersionedPackages = versionedPackages.filter((pkg) =>
    satisfiesVersion(pkg.getRange(), installedPkgVersion)
  );
  if (!matchingVersionedPackages.length) {
    // We don't want to patch this package version
    return originalExports;
  }

  const isMainFile = isMainJsFile(info, id, filename, packageJson);

  let interceptors: RequireInterceptor[] = [];

  if (isMainFile) {
    interceptors = matchingVersionedPackages
      .map((pkg) => pkg.getRequireInterceptors())
      .flat();
  } else {
    // Todo add support for onFileRequire interceptors
    return originalExports;
  }

  return executeInterceptors(
    interceptors,
    originalExports,
    pkgCache,
    filename as string
  );
}

/**
 * Executes the provided require interceptor functions and sets the cache.
 */
function executeInterceptors(
  interceptors: RequireInterceptor[],
  originalExports: unknown,
  cache: Map<string, unknown>,
  cacheKey: string
) {
  // Cache because we need to prevent this called again if module is imported inside interceptors
  cache.set(cacheKey, originalExports);

  // Return early if no interceptors
  if (!interceptors.length) {
    return originalExports;
  }

  // Foreach interceptor function
  for (const interceptor of interceptors) {
    // If one interceptor fails, we don't want to stop the other interceptors
    try {
      interceptor(originalExports);
    } catch (error) {
      // Todo handle (logger)
      console.error(error);
    }
  }

  // Variable originalExports now contains the changes made by the interceptors (if any)
  cache.set(cacheKey, originalExports);

  return originalExports;
}

export function getOrignalRequire() {
  return originalRequire;
}
