/* eslint-disable max-lines-per-function */
import type { LoadFunction } from "./types";
import { getModuleInfoFromPath } from "../getModuleInfoFromPath";
import { isBuiltinModule } from "../isBuiltinModule";
import { getPackageVersionFromPath } from "./getPackageVersionFromPath";
import { satisfiesVersion } from "../../../helpers/satisfiesVersion";
import { transformCode } from "./codeTransformation";
import { generateBuildinShim } from "./builtinShim";
import { Package } from "../Package";
import { BuiltinModule } from "../BuiltinModule";
import { getInstance } from "../../AgentSingleton";

let packages: Package[] = [];
let builtins: BuiltinModule[] = [];
// Todo check if caching is done by node or if we need to implement it

export function setPackagesToInstrument(_packages: Package[]) {
  packages = _packages;
}

export function setBuiltinsToInstrument(_builtins: BuiltinModule[]) {
  builtins = _builtins;
}

export function onModuleLoad(
  path: string,
  context: Parameters<LoadFunction>[1],
  previousLoadResult: ReturnType<LoadFunction>
): ReturnType<LoadFunction> {
  try {
    // Ignore unsupported formats, e.g. wasm, native addons or json
    if (
      !["builtin", "commonjs", "module"].includes(
        previousLoadResult.format ?? ""
      )
    ) {
      return previousLoadResult;
    }

    // The previousLoadResult.format must not be 'builtin' if it e.g. was modified by import-in-the-middle
    // import-in-the-middle returns 'module' for builtins that it patched to make the modification of builtins possible
    // The returned source is ignored if the format is 'builtin'
    const isBuiltin =
      previousLoadResult.format === "builtin" || isBuiltinModule(path);
    // True if already patched by another hook system
    const isModifiedBuiltin =
      (context.format &&
        context.format === "builtin" &&
        previousLoadResult.format !== "builtin") ||
      false;

    // For Node.js builtin modules
    if (isBuiltin) {
      return patchBuiltin(path, previousLoadResult, isModifiedBuiltin);
    }

    return patchPackage(path, previousLoadResult);
  } catch (error) {
    // Do not break the module loading process, just log the error
    return previousLoadResult;
  }
}

function patchPackage(
  path: string,
  previousLoadResult: ReturnType<LoadFunction>
) {
  const moduleInfo = getModuleInfoFromPath(path);
  if (!moduleInfo) {
    // This is e.g. the case for user code (not a dependency)
    // We don't want to modify user code yet
    return previousLoadResult;
  }

  const versionedPackages = packages
    .filter((pkg) => pkg.getName() === moduleInfo.name)
    .map((pkg) => pkg.getVersions())
    .flat();

  if (!versionedPackages) {
    // We don't want to modify this module
    return previousLoadResult;
  }

  // Check if the version of the package is supported
  const pkgVersion = getPackageVersionFromPath(moduleInfo.base);
  if (!pkgVersion) {
    // We can't determine the version of the package
    return previousLoadResult;
  }

  // Check if the installed package version is supported (get all matching versioned packages)
  const matchingVersionedPackages = versionedPackages.filter((pkg) =>
    satisfiesVersion(pkg.getRange(), pkgVersion)
  );

  const agent = getInstance();
  if (agent) {
    // Report to the agent that the package was wrapped or not if it's version is not supported
    agent.onPackageWrapped(moduleInfo.name, {
      version: pkgVersion,
      supported: !!matchingVersionedPackages.length,
    });
  }

  if (!matchingVersionedPackages.length) {
    // We don't want to patch this package version
    return previousLoadResult;
  }

  const instructions = matchingVersionedPackages
    .map((pkg) => pkg.getFileInstrumentationInstructions())
    .flat();

  const fileInstructions = instructions.find((f) => f.path === moduleInfo.path);
  if (!fileInstructions) {
    // We don't want to modify this file
    return previousLoadResult;
  }

  const isESM = previousLoadResult.format === "module";

  const newSource = transformCode(
    path,
    previousLoadResult.source.toString(),
    moduleInfo.name,
    isESM,
    fileInstructions
  );

  if (newSource === null) {
    return previousLoadResult;
  }

  return {
    format: previousLoadResult.format, // Todo maybe overwrite depending on the transformation
    shortCircuit: previousLoadResult.shortCircuit,
    source: newSource,
  };
}

function patchBuiltin(
  moduleName: string,
  previousLoadResult: ReturnType<LoadFunction>,
  isAlreadyModified: boolean
) {
  if (isAlreadyModified) {
    // Todo support
    return previousLoadResult;
  }

  const matchingBuiltins = builtins.filter(
    (b) => b.getName() === moduleName || `node:${b.getName()}` === moduleName
  );

  if (matchingBuiltins.length === 0) {
    // We don't want to modify this module
    return previousLoadResult;
  }

  if (matchingBuiltins.length > 1) {
    // Todo support?
    return previousLoadResult;
  }

  const functionInstructions = matchingBuiltins
    .map((b) =>
      b
        .getInstrumentationInstructions()
        .map((i) => i.functions)
        .flat()
    )
    .flat();

  if (!functionInstructions) {
    // We don't want to modify this module
    return previousLoadResult;
  }

  const shim = generateBuildinShim(moduleName, functionInstructions);
  if (!shim) {
    return previousLoadResult;
  }

  return {
    format: "commonjs",
    shortCircuit: previousLoadResult.shortCircuit,
    source: shim,
  };
}
