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
  for (const prop in original) {
    if (original.hasOwnProperty(prop)) {
      defineProperty(wrapped, prop, original[prop as keyof Function]);
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
