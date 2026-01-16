import type { LoadFunction } from "./types";
import { getModuleInfoFromPath } from "../getModuleInfoFromPath";
import { isBuiltinModule } from "../isBuiltinModule";
import { getPackageVersionFromPath } from "./getPackageVersionFromPath";
import { transformCode } from "./codeTransformation";
import {
  getPackageFileInstrumentationInstructions,
  shouldPatchBuiltin,
  shouldPatchFile,
  shouldPatchPackage,
} from "./instructions";
import { removeNodePrefix } from "../../../helpers/removeNodePrefix";
import { getInstance } from "../../AgentSingleton";
import { syncBuiltinESMExports } from "module";
import { getBuiltinModuleWithoutPatching } from "./processGetBuiltin";
import { wrapBuiltinExports } from "./wrapBuiltinExports";

const builtinPatchedSymbol = Symbol("zen.instrumentation.builtin.patched");

export function onModuleLoad(
  path: string,
  context: Parameters<LoadFunction>[1],
  previousLoadResult: ReturnType<LoadFunction>
): ReturnType<LoadFunction> {
  try {
    // Ignore unsupported formats, e.g. wasm, native addons or json
    if (
      // Sometimes the format is not set!
      previousLoadResult.format &&
      ![
        "builtin",
        "commonjs",
        "module",
        "commonjs-typescript",
        "module-typescript",
      ].includes(previousLoadResult.format)
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
      return patchBuiltin(path, previousLoadResult);
    }

    if (isSelfCheckImport(path)) {
      return updateSelfCheckSource(previousLoadResult);
    }

    return patchPackage(path, previousLoadResult);
  } catch (error) {
    // Do not break the module loading process, just log the error

    if (error instanceof Error) {
      getInstance()?.onFailedToWrapModule(path, error);
    }

    return previousLoadResult;
  }
}

export function patchPackage(
  path: string,
  previousLoadResult: ReturnType<LoadFunction>,
  isBundling = false
) {
  const moduleInfo = getModuleInfoFromPath(path);
  if (!moduleInfo) {
    // This is e.g. the case for user code (not a dependency)
    // We don't want to modify user code yet
    return previousLoadResult;
  }

  // Check if the version of the package is supported
  const pkgVersion = getPackageVersionFromPath(moduleInfo.base);
  if (!pkgVersion) {
    // We can't determine the version of the package
    return previousLoadResult;
  }

  getInstance()?.onPackageRequired(moduleInfo.name, pkgVersion);

  if (!shouldPatchPackage(moduleInfo.name)) {
    // We don't want to modify this module
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

  // Report to the agent that the package was wrapped or not if it's version is not supported
  getInstance()?.onPackageWrapped(moduleInfo.name, {
    version: pkgVersion,
    supported: !!matchingInstructions,
  });

  if (!matchingInstructions) {
    // We don't want to patch this package version or file
    return previousLoadResult;
  }

  const pkgLoadFormat =
    (previousLoadResult.format as "commonjs" | "module" | undefined) ??
    "unambiguous";

  const sourceString =
    typeof previousLoadResult.source === "string"
      ? previousLoadResult.source
      : new TextDecoder("utf-8").decode(previousLoadResult.source);

  const newSource = transformCode(
    moduleInfo.name,
    pkgVersion,
    path,
    sourceString,
    pkgLoadFormat,
    matchingInstructions,
    isBundling
  );

  // Todo if we not instrument the package we still want to modify it to insert the package loaded call

  // Prevent returning empty or undefined source text
  if (!newSource) {
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
  previousLoadResult: ReturnType<LoadFunction>
) {
  const builtinNameWithoutPrefix = removeNodePrefix(builtinName);

  const builtin = shouldPatchBuiltin(builtinNameWithoutPrefix);
  if (!builtin) {
    return previousLoadResult;
  }

  let orig = getBuiltinModuleWithoutPatching(builtinName) as
    | (object & { [builtinPatchedSymbol]?: boolean })
    | undefined;
  if (!orig) {
    return previousLoadResult;
  }

  if (orig[builtinPatchedSymbol]) {
    // The builtin module has already been patched, so we don't need to do it again
    return previousLoadResult;
  }

  const newExports = wrapBuiltinExports(builtinNameWithoutPrefix, orig);
  if (!newExports) {
    return previousLoadResult;
  }

  orig = newExports;
  syncBuiltinESMExports();

  // Mark the builtin as patched to avoid double patching
  orig[builtinPatchedSymbol] = true;

  return previousLoadResult;
}

function isSelfCheckImport(path: string) {
  // We can't use getModuleInfoFromPath as it would not work in unit tests
  return path
    .replace(/\\/g, "/")
    .includes("hooks/instrumentation/zenHooksCheckImport."); // .js or .ts
}

function updateSelfCheckSource(previousLoadResult: ReturnType<LoadFunction>) {
  const sourceString =
    typeof previousLoadResult.source === "string"
      ? previousLoadResult.source
      : new TextDecoder("utf-8").decode(previousLoadResult.source);

  return {
    ...previousLoadResult,
    source: sourceString.replace("//SELF_CHECK_REPLACE", ":)"),
  };
}
