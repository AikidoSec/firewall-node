export function formDataToPlainObject(formData: FormData) {
  const object: Map<string, unknown> = new Map();
  formData.forEach((value, key) => {
    if (typeof value !== "string") {
      return;
    }

    if (object.has(key)) {
      const entry = object.get(key);

      if (Array.isArray(entry)) {
        entry.push(value);
        return;
      }

      object.set(key, [object.get(key), value]);
      return;
    }

    object.set(key, value);
  });

  return Object.fromEntries(object);
}
