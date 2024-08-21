import { createWrappedFunction, wrap } from "../../helpers/wrap";

/**
 * This function allows to wrap a default export or a named export.
 * If the name is "default", it will wrap the default export of a module.
 */
export function wrapDefaultOrNamed(
  module: any,
  name: string,
  wrapper: (original: Function) => Function
) {
  if (name === "default") {
    return createWrappedFunction(module, wrapper);
  }
  return wrap(module, name, wrapper);
}
