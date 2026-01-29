import type { RequestHandler } from "express";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";
import { createWrappedFunction } from "../../helpers/wrap";

export function wrapRequestHandler(handler: RequestHandler): RequestHandler {
  const fn = createWrappedFunction(handler, function wrap(handler) {
    return function wrap(this: RequestHandler) {
      if (arguments.length === 0) {
        return handler.apply(this);
      }

      const context = contextFromRequest(arguments[0]);

      return runWithContext(context, () => {
        return handler.apply(this, arguments);
      });
    };
  }) as RequestHandler;

  // Some libraries/apps have properties on the handler functions that are not copied by our createWrappedFunction function
  // (createWrappedFunction only copies properties when hasOwnProperty is true)
  // Let's set up a proxy to forward the property access to the original handler
  // e.g. https://github.com/TryGhost/Ghost/blob/fefb9ec395df8695d06442b6ecd3130dae374d94/ghost/core/core/frontend/web/site.js#L192
  for (const key in handler) {
    if (Object.prototype.hasOwnProperty.call(handler, key)) {
      continue;
    }

    Object.defineProperty(fn, key, {
      get() {
        // @ts-expect-error Types unknown
        return handler[key];
      },
      set(value) {
        // @ts-expect-error Types unknown
        handler[key] = value;
      },
    });
  }

  // For some libraries/apps it's important to preserve the function name
  // e.g. Ghost looks up a middleware function by name in the router stack
  preserveLayerName(fn, handler.name);

  return fn;
}

/**
 * Object.getOwnPropertyDescriptor(function myFunction() {}, "name")
 * {
 *   value: 'myFunction',
 *   writable: false,
 *   enumerable: false,
 *   configurable: true
 * }
 */
function preserveLayerName(wrappedFunction: Function, originalName: string) {
  try {
    Object.defineProperty(wrappedFunction, "name", {
      value: originalName,
      writable: false,
      enumerable: false,
      configurable: true,
    });
  } catch {
    // Ignore
  }
}
