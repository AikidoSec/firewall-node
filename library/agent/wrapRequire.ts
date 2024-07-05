import * as mod from "module";
import { ModifyingRequireInterceptor } from "./hooks/ModifyingRequireInterceptor";
import { createWrappedFunction } from "../helpers/wrap";
import { Agent } from "./Agent";
const req = mod.prototype.require;

let wrappedRequire = false;
let interceptors: ModifyingRequireInterceptor[] = [];
let requireCache = new Map<string, Function>();

export function wrapRequire(
  reqInterceptors: ModifyingRequireInterceptor[],
  agent: Agent
) {
  interceptors = reqInterceptors;
  // Clear the require cache if interceptors have changed
  if (wrappedRequire) {
    requireCache = new Map<string, Function>();
  }
  if (wrappedRequire) {
    return;
  }
  wrappedRequire = true;

  // @ts-expect-error Ignore type error
  mod.prototype.require = function wrap() {
    const interceptor = interceptors.find((i) => i.getName() === arguments[0]);
    if (!interceptor) {
      return req.apply(
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments as unknown as [string]
      );
    }

    if (requireCache.has(interceptor.getName())) {
      return requireCache.get(interceptor.getName());
    }

    const original = req.apply(
      this, // eslint-disable-next-line prefer-rest-params
      arguments as unknown as [string]
    );

    if (typeof original !== "function") {
      throw new Error(
        "Module must export a function to be wrapped during require"
      );
    }

    const wrapper = function () {
      const originalReturnValue = original.apply(
        // @ts-expect-error We don't now the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
      // eslint-disable-next-line prefer-rest-params
      const args = Array.from(arguments);
      return interceptor.getInterceptor()(args, originalReturnValue, agent);
    };

    const wrappedFunction = createWrappedFunction(original, () => wrapper);
    requireCache.set(interceptor.getName(), wrappedFunction);

    return wrappedFunction;
  };
}
