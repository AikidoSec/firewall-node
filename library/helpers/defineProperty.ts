// Sets a property on an object, preserving its enumerability.
// This function assumes that the property is already writable.
export function defineProperty(obj: unknown, name: string, value: unknown) {
  // @ts-expect-error We don't know the type of obj
  const enumerable = !!obj[name] && obj.propertyIsEnumerable(name);

  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: enumerable,
    writable: true,
    value: value,
  });
}
