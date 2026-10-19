import { createWrappedFunction, isWrapped, wrap } from "../../helpers/wrap";

/**
 * This function allows to wrap a default export or a named export.
 * If the name is undefined, it will wrap the default export of a module.
 */
export function wrapDefaultOrNamed(
  module: any,
  name: string | undefined,
  wrapper: (original: Function) => Function
) {
  const original = typeof name === "undefined" ? module : module[name];

  if (isWrapped(original)) {
    return original;
  }

  if (typeof name === "undefined") {
    return createWrappedFunction(module, wrapper);
  }
  return wrap(module, name, wrapper);
}
