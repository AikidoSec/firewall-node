import type { RequestHandler } from "express";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";

export function wrapRequestHandler(handler: RequestHandler): RequestHandler {
  const fn: RequestHandler = (req, res, next) => {
    const context = contextFromRequest(req);

    return runWithContext(context, () => {
      return handler(req, res, next);
    });
  };

  if (handler.name) {
    preserveFunctionName(fn, handler.name);
  }

  return fn;
}

/**
 * Preserve the original function name
 * e.g. Ghost looks up a middleware function by name in the router stack
 *
 * Object.getOwnPropertyDescriptor(function myFunction() {}, "name")
 *
 * {
 *   value: 'myFunction',
 *   writable: false,
 *   enumerable: false,
 *   configurable: true
 * }
 */
function preserveFunctionName(wrappedFunction: Function, originalName: string) {
  try {
    Object.defineProperty(wrappedFunction, "name", {
      value: originalName,
      writable: false,
      enumerable: false,
      configurable: true,
    });
  } catch (e) {
    // Ignore
  }
}
