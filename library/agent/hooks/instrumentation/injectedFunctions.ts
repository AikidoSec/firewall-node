import { getInstance } from "../../AgentSingleton";
import { WrapPackageInfo } from "../WrapPackageInfo";
import { getBuiltinInterceptors, getPackageCallbacks } from "./instructions";

export function __instrumentInspectArgs(id: string, args: unknown[]): void {
  const agent = getInstance();
  if (!agent) {
    return;
  }

  const cbFuncs = getPackageCallbacks(id);

  if (typeof cbFuncs.inspectArgs === "function") {
    // Todo support subject?
    cbFuncs.inspectArgs(args, agent, undefined);
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

  // Todo check if cache is needed
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
