import * as mod from "module";
import { BuiltinModule } from "./BuiltinModule";
import { isBuiltinModule } from "./isBuiltinModule";
import { getModuleInfoFromPath } from "./getModuleInfoFromPath";
import { Package } from "./Package";
import { satisfiesVersion } from "../../helpers/satisfiesVersion";
import { removeNodePrefix } from "../../helpers/removeNodePrefix";
import { getPackageVersionWithPath } from "../../helpers/getPackageVersion";

const originalRequire = mod.prototype.require;
let isPatched = false;

/**
 * Todos
 * - process.getBuiltinModule
 * - Cache
 */

let packages: Package[] = [];
let builtinModules: BuiltinModule[] = [];

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
    if (!isPatched) {
      // Can happen if the require function is also patched by another npm package
      return originalRequire.apply(this, arguments as unknown as [string]);
    }

    return patchedRequire.call(this, arguments);
  };
}

export function unwrapRequire() {
  if (!isPatched) {
    return;
  }
  isPatched = false;
  mod.prototype.require = originalRequire;
}

export function setPackagesToPatch(packagesToPatch: Package[]) {
  packages = packagesToPatch;
}

export function setBuiltinModulesToPatch(
  builtinModulesToPatch: BuiltinModule[]
) {
  builtinModules = builtinModulesToPatch;
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
  /**
   * If true, its for sure a builtin module. If undefined, it's not clear if it's a builtin module.
   */
  let isBuiltin = isBuiltinModule(id);
  let moduleName: string | undefined;
  let filename: string | undefined;
  try {
    // Only true in Node.js v18.6.0, v16.17.0 or newer - should improve the performance
    if (isBuiltin) {
      moduleName = removeNodePrefix(id);

      // Todo check if in cache here

      const builtinModule = builtinModules.find(
        (m) => m.getName() === moduleName
      );

      // We don't want to patch this builtin module
      if (!builtinModule) {
        return originalExports;
      }

      //interceptors = builtinModule.getRequireInterceptors();
    } else {
      // @ts-expect-error Not included in the Node.js types
      filename = mod._resolveFilename(id, this);
      if (!filename) {
        throw new Error("Could not resolve filename using _resolveFilename");
      }

      // Todo check if in cache here

      const info = getModuleInfoFromPath(filename);
      if (!info) {
        throw new Error("Could not get module info from path");
      }
      moduleName = info.name;

      // Todo check if require of package itself or a file in the package !!!

      const versionedPackages = packages
        .find((pkg) => pkg.getName() === moduleName)
        ?.getVersions();
      // We don't want to patch this package
      if (!versionedPackages) {
        return originalExports;
      }

      const installedPkgVersion = getPackageVersionWithPath(info.base);
      if (!installedPkgVersion) {
        throw new Error(
          `Could not get installed package version for ${moduleName}`
        );
      }

      const matchingInterceptors = versionedPackages
        .map((pkg) => {
          if (!satisfiesVersion(pkg.getRange(), installedPkgVersion)) {
            return [];
          }
          return pkg.getRequireInterceptors();
        })
        .flat();

      for (const interceptor of matchingInterceptors) {
        interceptor(originalExports, installedPkgVersion);
      }
    }

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
