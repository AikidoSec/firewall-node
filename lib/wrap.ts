/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/no-explicit-any */
interface WrappedFunction extends Function {
  [key: string]: any;
  __aikido_wrapped__?: WrappedFunction;
  __aikido_original__?: WrappedFunction;
}

/**
 * Replace a method in an object with a wrapped version of itself.
 */
export function fill(
  source: { [key: string]: any },
  name: string,
  replacementFactory: (...args: any[]) => any
): void {
  if (!(name in source)) {
    return;
  }

  const original = source[name] as () => any;
  const wrapped = replacementFactory(original) as WrappedFunction;

  // Make sure it's a function first, as we need to attach an empty prototype for `defineProperties` to work
  // otherwise it'll throw "TypeError: Object.defineProperties called on non-object"
  if (typeof wrapped === "function") {
    markFunctionWrapped(wrapped, original);
  }

  source[name] = wrapped;
}

/**
 * Defines a non-enumerable property on the given object.
 *
 * @param obj The object on which to set the property
 * @param name The name of the property to be set
 * @param value The value to which to set the property
 */
export function addNonEnumerableProperty(
  obj: object,
  name: string,
  value: unknown
): void {
  try {
    Object.defineProperty(obj, name, {
      // enumerable: false, // the default, so we can save on bundle size by not explicitly setting it
      value: value,
      writable: true,
      configurable: true,
    });
  } catch (o_O) {
    /*DEBUG_BUILD &&
      logger.log(
        `Failed to add non-enumerable property "${name}" to object`,
        obj
      );*/
  }
}

/**
 * Remembers the original function on the wrapped function and
 * patches up the prototype.
 *
 * @param wrapped the wrapper function
 * @param original the original function that gets wrapped
 */
export function markFunctionWrapped(
  wrapped: WrappedFunction,
  original: WrappedFunction
): void {
  try {
    const proto = original.prototype || {};
    wrapped.prototype = original.prototype = proto;
    addNonEnumerableProperty(wrapped, "__aikido_original__", original);
  } catch (o_O) {} // eslint-disable-line no-empty
}

/**
 * This extracts the original function if available.  See
 * `markFunctionWrapped` for more information.
 *
 * @param func the function to unwrap
 * @returns the unwrapped version of the function if available.
 */
export function getOriginalFunction(
  func: WrappedFunction
): WrappedFunction | undefined {
  return func.__aikido_original__;
}
