export function wrap(
  nodule: any,
  name: string,
  wrapper: (original: Function) => Function
) {
  if (!nodule[name]) {
    throw new Error(`no original function ${name} to wrap`);
  }

  if (typeof nodule[name] !== "function") {
    throw new Error(
      `original must be a function, instead found: ${typeof nodule[name]}`
    );
  }

  const original = nodule[name];
  const wrapped = wrapper(original);

  defineProperty(wrapped, "__original", original);
  defineProperty(wrapped, "__wrapped", true);

  // Copy over all properties from the original function to the wrapped one.
  // e.g. fs.realpath.native
  // .inspect("realpath", (args) => {...})
  // We don't want to lose the original function's properties.
  // Most of the functions we're wrapping don't have any properties, so this is a rare case.
  for (const prop in nodule[name]) {
    if (nodule[name].hasOwnProperty(prop)) {
      defineProperty(wrapped, prop, nodule[name][prop]);
    }
  }

  defineProperty(nodule, name, wrapped);

  return wrapped;
}

// Sets a property on an object, preserving its enumerability.
// This function assumes that the property is already writable.
function defineProperty(obj: unknown, name: string | number, value: unknown) {
  // @ts-expect-error We don't know the type of obj
  const enumerable = !!obj[name] && obj.propertyIsEnumerable(name);
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: enumerable,
    writable: true,
    value: value,
  });
}
