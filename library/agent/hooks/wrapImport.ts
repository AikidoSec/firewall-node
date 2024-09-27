/* eslint-disable max-lines-per-function */
import { register } from "module";
import { pathToFileURL } from "url";
import { Hook } from "import-in-the-middle";
import { BuiltinModule } from "./BuiltinModule";
import { Package } from "./Package";
import { isBuiltinModule } from "./isBuiltinModule";
import { getInstance } from "../AgentSingleton";
import { removeNodePrefix } from "../../helpers/removeNodePrefix";
import { executeInterceptors } from "./executeInterceptors";
import { getModuleInfoFromPath, ModulePathInfo } from "./getModuleInfoFromPath";
import { getOrignalRequire } from "./wrapRequire";
import type { PackageJson } from "type-fest";
import { satisfiesVersion } from "../../helpers/satisfiesVersion";
import { RequireInterceptor } from "./RequireInterceptor";
import { isMainJsFile } from "./isMainJsFile";
import { join } from "path";

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

  executeInterceptors(interceptors, exports, undefined, undefined, {
    name: moduleName,
    type: "builtin",
  });
}

function getRelativeImportedFilePath(packageName: string, importName: string) {
  if (!importName.startsWith(packageName)) {
    return importName;
  }
  return importName.substring(packageName.length + 1);
}

function patchPackage(
  exports: any,
  importName: string,
  baseDir: string | void
) {
  // Ignore .json files
  if (importName.endsWith(".json")) {
    return;
  }

  // Required for getting package version
  if (!baseDir) {
    throw new Error("Can not patch package without baseDir");
  }

  // Base dir and importName include the package name
  // The importName also includes the path to the file inside the imported package
  // We call getModuleInfoFromPath with the importName to get the package name because packages can have a scope
  // Do not use pathInfo.base because its wrong, use baseDir instead!
  const pathInfoForName = getModuleInfoFromPath(`node_modules/${importName}`);
  if (!pathInfoForName) {
    // Can happen if the package is not inside a node_modules folder, like the dev build of our library itself
    return;
  }
  const packageName = pathInfoForName.name;

  const pathInfo: ModulePathInfo = {
    name: packageName,
    base: baseDir,
    path: getRelativeImportedFilePath(packageName, importName),
  };

  // Get all versioned packages for the module name
  const versionedPackages = packages
    .filter((pkg) => pkg.getName() === packageName)
    .map((pkg) => pkg.getVersions())
    .flat();

  // We don't want to patch this package because we do not have any hooks for it
  if (!versionedPackages.length) {
    return;
  }

  // Get the original require function (if it was wrapped)
  const requireFunc = getOrignalRequire() || require;

  // Read the package.json of the required package
  const packageJson = requireFunc(`${baseDir}/package.json`) as PackageJson;

  // Get the version of the installed package
  const installedPkgVersion = packageJson.version;
  if (!installedPkgVersion) {
    throw new Error(
      `Could not get installed package version for ${packageName} on import`
    );
  }

  // Check if the installed package version is supported (get all matching versioned packages)
  const matchingVersionedPackages = versionedPackages.filter((pkg) =>
    satisfiesVersion(pkg.getRange(), installedPkgVersion)
  );

  const agent = getInstance();
  if (agent) {
    // Report to the agent that the package was wrapped or not if it's version is not supported
    agent.onPackageWrapped(packageName, {
      version: installedPkgVersion,
      supported: !!matchingVersionedPackages.length,
    });
  }

  if (!matchingVersionedPackages.length) {
    // We don't want to patch this package version
    return;
  }

  const fullFilePath = join(pathInfo.base, pathInfo.path);

  // Check if the imported file is the main file of the package or another js file inside the package
  const isMainFile = isMainJsFile(
    pathInfo,
    undefined,
    fullFilePath,
    packageJson,
    true
  );

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

  executeInterceptors(interceptors, exports, undefined, undefined, {
    name: pathInfo.name,
    version: installedPkgVersion,
    type: "external",
    path: {
      base: pathInfo.base,
      relative: pathInfo.path,
    },
  });
}
