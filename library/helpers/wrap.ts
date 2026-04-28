export const wrappedSymbol = Symbol.for("zen.function.wrapped");
export const originalSymbol = Symbol.for("zen.function.original");

type WrappedFunction<T> = T & {
  [originalSymbol]: T;
};

export function wrap(
  module: any,
  name: string,
  wrapper: (original: Function) => Function
) {
  if (!module[name]) {
    throw new Error(`no original function ${name} to wrap`);
  }

  if (typeof module[name] !== "function") {
    throw new Error(
      `original must be a function, instead found: ${typeof module[name]}`
    );
  }

  const original = module[name];
  const wrapped = createWrappedFunction(original, wrapper);

  defineProperty(module, name, wrapped);

  return wrapped;
}

export function createWrappedFunction(
  original: Function,
  wrapper: (original: Function) => Function
): Function {
  const wrapped = wrapper(original);

  defineProperty(wrapped, originalSymbol, original);
  defineProperty(wrapped, wrappedSymbol, true);

  // Copy over all properties from the original function to the wrapped one.
  // e.g. fs.realpath.native
  // .inspect("realpath", (args) => {...})
  // We don't want to lose the original function's properties.
  // Most of the functions we're wrapping don't have any properties, so this is a rare case.
  // Inspired by https://github.com/DataDog/dd-trace-js/blob/master/packages/datadog-shimmer/src/shimmer.js#L8

  Object.setPrototypeOf(wrapped, original);

  const props = Object.getOwnPropertyDescriptors(original);
  const keys = Reflect.ownKeys(props);

  for (const key of keys) {
    try {
      // Define the property on the wrapped function, keeping the original property's attributes.
      Object.defineProperty(wrapped, key as any, props[key as any]);
    } catch {
      //
    }
  }

  return wrapped;
}

// Sets a property on an object, preserving its enumerability.
// This function assumes that the property is already writable.
function defineProperty(obj: unknown, name: PropertyKey, value: unknown) {
  const enumerable =
    // @ts-expect-error We don't know the type of obj
    !!obj[name] && Object.prototype.propertyIsEnumerable.call(obj, name);
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: enumerable,
    writable: true,
    value: value,
  });
}

/**
 * Check if a function is wrapped
 */
export function isWrapped<T>(fn: T): fn is WrappedFunction<T> {
  return (
    fn instanceof Function &&
    wrappedSymbol in fn &&
    fn[wrappedSymbol] === true &&
    originalSymbol in fn &&
    fn[originalSymbol] instanceof Function
  );
}
