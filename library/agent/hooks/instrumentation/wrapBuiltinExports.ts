import { getInstance } from "../../AgentSingleton";
import type { WrapPackageInfo } from "../WrapPackageInfo";
import { getBuiltinInterceptors } from "./instructions";

export function wrapBuiltinExports(id: string, exports: unknown): unknown {
  const agent = getInstance();
  if (!agent) {
    return exports;
  }

  const interceptors = getBuiltinInterceptors(id);

  if (interceptors.length === 0) {
    return exports;
  }

  agent.onBuiltinWrapped(id);

  const pkgInfo: WrapPackageInfo = {
    name: id,
    type: "builtin",
  };

  for (const interceptor of interceptors) {
    try {
      const returnVal = interceptor(exports, pkgInfo);
      // If the interceptor returns a value, we want to use this value as the new exports
      if (returnVal !== undefined) {
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
