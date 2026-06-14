export function formDataToPlainObject(formData: FormData) {
  const object: Map<string, unknown> = new Map();
  formData.forEach((value, key) => {
    if (typeof value !== "string") {
      return;
    }

    if (object.has(key)) {
      // If the key already exists, treat it as an array
      const entry = object.get(key);

      if (Array.isArray(entry)) {
        // If it's already an array, just push the new value
        entry.push(value);
        return;
      }

      // Convert it to an array
      object.set(key, [object.get(key), value]);
      return;
    }

    object.set(key, value);
  });

  return Object.fromEntries(object);
}
