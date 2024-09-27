import { getInstance } from "../AgentSingleton";
import type { RequireInterceptor } from "./RequireInterceptor";
import type { WrapPackageInfo } from "./WrapPackageInfo";

/**
 * Executes the provided require interceptor functions and sets the cache.
 */
export function executeInterceptors(
  interceptors: RequireInterceptor[],
  exports: unknown,
  cache: Map<string, unknown> | undefined,
  cacheKey: string | undefined,
  wrapPackageInfo: WrapPackageInfo
) {
  // Cache because we need to prevent this called again if module is imported inside interceptors
  if (cache && cacheKey) {
    cache.set(cacheKey, exports);
  }

  // Return early if no interceptors
  if (!interceptors.length) {
    return exports;
  }

  // Foreach interceptor function
  for (const interceptor of interceptors) {
    // If one interceptor fails, we don't want to stop the other interceptors
    try {
      const returnVal = interceptor(exports, wrapPackageInfo);
      // If the interceptor returns a value, we want to use this value as the new exports
      if (typeof returnVal !== "undefined") {
        exports = returnVal;
      }
    } catch (error) {
      if (error instanceof Error) {
        getInstance()?.onFailedToWrapModule(wrapPackageInfo.name, error);
      }
    }
  }

  // Finally cache the result
  if (cache && cacheKey) {
    cache.set(cacheKey, exports);
  }

  return exports;
}
