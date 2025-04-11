import { isPlainObject } from "./isPlainObject";

export function formDataToPlainObject(formData: FormData) {
  const object: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (typeof value === "object" && !isPlainObject(value)) {
      return;
    }

    if (!(key in object)) {
      object[key] = value;
      return;
    }

    if (!Array.isArray(object[key])) {
      object[key] = [object[key], value];
      return;
    }

    object[key].push(value);
  });
  return object;
}
