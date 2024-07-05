import * as mod from "module";
import { ModifyingRequireInterceptor } from "./hooks/ModifyingRequireInterceptor";
import { defineProperty } from "../helpers/wrap";
import { Agent } from "./Agent";
const req = mod.prototype.require;

let wrappedRequire = false;
let interceptors: ModifyingRequireInterceptor[] = [];

export function wrapRequire(
  reqInterceptors: ModifyingRequireInterceptor[],
  agent: Agent
) {
  interceptors = reqInterceptors;
  if (wrappedRequire) {
    return;
  }
  wrappedRequire = true;

  // @ts-expect-error Ignore type error
  mod.prototype.require = function wrap(id) {
    const interceptor = interceptors.find((i) => i.getName() === id);
    if (!interceptor) {
      return req.apply(this, [id]);
    }

    const original = req.apply(this, [id]);

    if (typeof original !== "function") {
      throw new Error(
        "Module must export a function to be wrapped during require"
      );
    }

    const wrapped = function () {
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

    defineProperty(wrapped, "__original", original);
    defineProperty(wrapped, "__wrapped", true);

    // Copy over all properties from the original function to the wrapped one.
    // We don't want to lose the original function's properties.
    // Most of the functions we're wrapping don't have any properties, so this is a rare case.
    for (const prop in original) {
      if (original.hasOwnProperty(prop)) {
        defineProperty(wrapped, prop, original[prop]);
      }
    }

    return wrapped;
  };
}
