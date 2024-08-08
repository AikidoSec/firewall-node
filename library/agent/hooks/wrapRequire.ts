import * as mod from "module";
import { BuiltinModule } from "./BuiltinModule";
import { isBuiltinModule } from "./isBuiltinModule";
import { getModuleInfoFromPath } from "./getModuleInfoFromPath";
import { Package } from "./Package";
import { satisfiesVersion } from "../../helpers/satisfiesVersion";
import { removeNodePrefix } from "../../helpers/removeNodePrefix";
import { RequireInterceptor } from "./RequireInterceptor";
import { join } from "path";

const originalRequire = mod.prototype.require;
let isPatched = false;

/**
 * Todo
 * - process.getBuiltinModule
 * - https://nodejs.org/api/packages.html#package-entry-points
 */

let packages: Package[] = [];
let builtinModules: BuiltinModule[] = [];
let pkgCache = new Map<string, unknown>();
let builtinCache = new Map<string, unknown>();

export function wrapRequire() {
  if (isPatched) {
    return;
  }
  // @ts-expect-error Not included in the Node.js types
  if (typeof mod._resolveFilename !== "function") {
    throw new Error(
      `Could not find the _resolveFilename function in node:module using Node.js version ${process.version}`
    );
  }
  isPatched = true;

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
   */
  const id = args[0] as string;
  let isBuiltin = isBuiltinModule(id);
  let moduleName: string | undefined;
  let filename: string | undefined;
  let interceptors: RequireInterceptor[] = [];

  try {
    if (isBuiltin) {
      moduleName = removeNodePrefix(id);

      if (builtinCache.has(moduleName)) {
        return builtinCache.get(moduleName);
      }

      const builtinModule = builtinModules.find(
        (m) => m.getName() === moduleName
      );

      // We don't want to patch this builtin module
      if (!builtinModule) {
        return originalExports;
      }

      interceptors = builtinModule.getRequireInterceptors();
    } else {
      // @ts-expect-error Not included in the Node.js types
      filename = mod._resolveFilename(id, this);
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
      moduleName = info.name;

      const versionedPackages = packages
        .find((pkg) => pkg.getName() === moduleName)
        ?.getVersions();
      // We don't want to patch this package
      if (!versionedPackages) {
        return originalExports;
      }

      const packageJson = originalRequire(`${info.base}/package.json`);

      const installedPkgVersion = packageJson.version;
      if (!installedPkgVersion) {
        throw new Error(
          `Could not get installed package version for ${moduleName}`
        );
      }

      let isMainJSFile = false;
      if (moduleName === id) {
        isMainJSFile = true;
      } else {
        // Check package.json for main and exports
        if (
          typeof packageJson.main === "string" &&
          // Todo check different cases
          join(info.base, packageJson.main) === filename
        ) {
          isMainJSFile = true;
        }
        // Todo check exports
      }

      if (!isMainJSFile) {
        // Todo add support for onFileRequire interceptors
        return originalExports;
      }

      interceptors = versionedPackages
        .map((pkg) => {
          if (!satisfiesVersion(pkg.getRange(), installedPkgVersion)) {
            return [];
          }
          return pkg.getRequireInterceptors();
        })
        .flat();
    }

    // Cache because we need to prevent this called again if module is imported inside interceptors
    const cacheKey = isBuiltin ? moduleName : (filename as string);
    const cache = isBuiltin ? builtinCache : pkgCache;
    cache.set(cacheKey, originalExports);

    for (const interceptor of interceptors) {
      // If one interceptor fails, we don't want to stop the other interceptors
      try {
        interceptor(originalExports);
      } catch (error) {
        // Todo handle (logger)
        console.error(error);
      }
    }

    cache.set(cacheKey, originalExports);

    return originalExports;
  } catch (error) {
    // Todo handle (logger)
    console.error(error);
    return originalExports;
  }
}

export function getOrignalRequire() {
  return originalRequire;
}
