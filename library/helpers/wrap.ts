type WrappedFunction<T> = T & {
  __original: T;
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

  defineProperty(wrapped, "__original", original);
  defineProperty(wrapped, "__wrapped", true);

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
    } catch (e) {
      //
    }
  }

  return wrapped;
}

// Sets a property on an object, preserving its enumerability.
// This function assumes that the property is already writable.
function defineProperty(obj: unknown, name: string, value: unknown) {
  // @ts-expect-error We don't know the type of obj
  const enumerable = !!obj[name] && obj.propertyIsEnumerable(name);
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: enumerable,
    writable: true,
    value: value,
  });
}

/**
 * Check if a function was wrapped by the wrap function
 */
export function isFunctionWrapped(fn: Function): boolean {
  return (
    fn instanceof Function &&
    "__wrapped" in fn &&
    fn.__wrapped === true &&
    "__original" in fn &&
    fn.__original instanceof Function
  );
}
