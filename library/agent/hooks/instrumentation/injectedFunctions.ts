import { getInstance } from "../../AgentSingleton";
import { getContext } from "../../Context";
import { inspectArgs } from "../wrapExport";
import { WrapPackageInfo } from "../WrapPackageInfo";
import { getBuiltinInterceptors, getPackageCallbacks } from "./instructions";
import { getBuiltinModuleWithoutPatching } from "./processGetBuiltin";

export function __instrumentInspectArgs(
  id: string,
  args: unknown[],
  pkgName: string,
  pkgVersion: string,
  methodName: string
) {
  const agent = getInstance();
  if (!agent) {
    return;
  }

  const context = getContext();

  const cbFuncs = getPackageCallbacks(id);

  if (typeof cbFuncs.inspectArgs === "function") {
    // Todo check subject (this) might be broken?
    inspectArgs(
      args,
      cbFuncs.inspectArgs,
      context,
      agent,
      {
        name: pkgName,
        version: pkgVersion,
        type: "external",
      },
      methodName
    );
  }
}

export function __wrapBuiltinExports(id: string, exports: unknown): unknown {
  const agent = getInstance();
  if (!agent) {
    return exports;
  }

  const interceptors = getBuiltinInterceptors(id);

  if (interceptors.length === 0) {
    return exports;
  }

  const pkgInfo: WrapPackageInfo = {
    name: id,
    type: "builtin",
  };

  for (const interceptor of interceptors) {
    try {
      const returnVal = interceptor(exports, pkgInfo);
      // If the interceptor returns a value, we want to use this value as the new exports
      if (typeof returnVal !== "undefined") {
        exports = returnVal;
      }
    } catch (error) {
      if (error instanceof Error) {
        getInstance()?.onFailedToWrapModule(pkgInfo.name, error);
      }
    }
  }

  return exports;
}

export function __instrumentModifyArgs(id: string, args: unknown[]): unknown[] {
  if (!Array.isArray(args)) {
    return [];
  }

  const agent = getInstance();
  if (!agent) {
    return args;
  }

  try {
    const cbFuncs = getPackageCallbacks(id);

    if (typeof cbFuncs.modifyArgs === "function") {
      const newArgs = cbFuncs.modifyArgs(args, agent);
      // Only return the new arguments if they are an array
      if (Array.isArray(newArgs)) {
        return newArgs;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      getInstance()?.onFailedToWrapModule(id.split(".")[0], error);
    }
  }

  return args;
}

export function __getBuiltinModuleWithoutPatching(id: string) {
  return getBuiltinModuleWithoutPatching(id);
}
