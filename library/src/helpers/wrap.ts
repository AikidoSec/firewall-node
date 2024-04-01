export function wrap(
  nodule: unknown,
  name: string,
  wrapper: (original: Function) => Function
) {
  // @ts-expect-error We don't know the type of nodule
  if (!nodule[name]) {
    throw new Error(`no original function ${name} to wrap`);
  }

  // @ts-expect-error We don't know the type of nodule
  if (typeof nodule[name] !== "function") {
    throw new Error(
      // @ts-expect-error We don't know the type of nodule
      `original must be a function, instead found: ${typeof nodule[name]}`
    );
  }

  // @ts-expect-error We don't know the type of nodule
  const original = nodule[name];
  const wrapped = wrapper(original);

  defineProperty(wrapped, "__original", original);
  defineProperty(wrapped, "__wrapped", true);
  defineProperty(nodule, name, wrapped);

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
