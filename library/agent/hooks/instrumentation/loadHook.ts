/* eslint-disable max-lines-per-function */
import type { LoadFunction } from "./types";
import { getModuleInfoFromPath } from "../getModuleInfoFromPath";
import { isBuiltinModule } from "../isBuiltinModule";
import { getPackageVersionFromPath } from "./getPackageVersionFromPath";
import { transformCode } from "./codeTransformation";
import { generateBuildinShim } from "./builtinShim";
import {
  getPackageFileInstrumentationInstructions,
  shouldPatchBuiltin,
  shouldPatchFile,
  shouldPatchPackage,
} from "./instructions";
import { removeNodePrefix } from "../../../helpers/removeNodePrefix";
import { getInstance } from "../../AgentSingleton";

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

    // For Node.js builtin modules
    if (isBuiltin) {
      return patchBuiltin(path, previousLoadResult, context);
    }

    return patchPackage(path, previousLoadResult);
  } catch (error) {
    console.error("Error in onModuleLoad", error); // We don't have a logger yet :(
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

  if (!shouldPatchPackage(moduleInfo.name)) {
    // We don't want to modify this module
    return previousLoadResult;
  }

  // Check if the version of the package is supported
  const pkgVersion = getPackageVersionFromPath(moduleInfo.base);
  if (!pkgVersion) {
    // We can't determine the version of the package
    return previousLoadResult;
  }

  if (!shouldPatchFile(moduleInfo.name, moduleInfo.path)) {
    // We don't want to patch this file
    return previousLoadResult;
  }

  // Right now we only allow one matching instruction set for one file
  // So if e.g. multiple version are matching, we only use the first one
  const matchingInstructions = getPackageFileInstrumentationInstructions(
    moduleInfo.name,
    pkgVersion,
    moduleInfo.path
  );

  const agent = getInstance();
  if (agent) {
    // Report to the agent that the package was wrapped or not if it's version is not supported
    agent.onPackageWrapped(moduleInfo.name, {
      version: pkgVersion,
      supported: !!matchingInstructions,
    });
  }

  if (!matchingInstructions) {
    // We don't want to patch this package version or file
    return previousLoadResult;
  }

  const isESM = previousLoadResult.format === "module";

  const newSource = transformCode(
    path,
    previousLoadResult.source.toString(),
    isESM,
    matchingInstructions
  );

  if (newSource === null) {
    return previousLoadResult;
  }

  return {
    format: previousLoadResult.format,
    shortCircuit: previousLoadResult.shortCircuit,
    source: newSource,
  };
}

function patchBuiltin(
  builtinName: string,
  previousLoadResult: ReturnType<LoadFunction>,
  context: Parameters<LoadFunction>[1]
) {
  // Todo test if used with import-in-the-middle at the same time

  const builtinNameWithoutPrefix = removeNodePrefix(builtinName);

  const builtin = shouldPatchBuiltin(builtinNameWithoutPrefix);
  if (!builtin) {
    return previousLoadResult;
  }

  const isCJSRequire =
    (Array.isArray(context.conditions) &&
      context.conditions.includes("require")) ||
    ("has" in context.conditions &&
      typeof context.conditions.has === "function" &&
      context.conditions.has("require"));

  const shim = generateBuildinShim(
    builtinName,
    builtinNameWithoutPrefix,
    isCJSRequire
  );
  if (!shim) {
    return previousLoadResult;
  }

  return {
    format: "commonjs",
    shortCircuit: previousLoadResult.shortCircuit,
    source: shim,
  };
}
