import * as mod from "module";
import { ModifyingRequireInterceptor } from "./hooks/ModifyingRequireInterceptor";
import { defineProperty } from "../helpers/wrap";
const req = mod.prototype.require;

const interceptors: ModifyingRequireInterceptor[] = [];

export function wrapRequire() {
  // @ts-expect-error Ignore type error
  mod.prototype.require = function (id) {
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

    if (original.__wrapped) {
      return original;
    }

    const wrapped = function () {
      const instance = original.apply(
        // @ts-expect-error We don't now the type of this
        this,
        arguments
      );
      // @ts-ignore Todo
      return interceptor.getInterceptor()(arguments, instance);
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

    // Todo prevent multiple wrapping
  };

  console.log(require.resolve("module"));
}

export function addRequireInterceptor(
  interceptor: ModifyingRequireInterceptor
) {
  interceptors.push(interceptor);
}
