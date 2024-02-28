import { isPlainObject } from "./isPlainObject";

export function convertRequestBodyToString(
  body: unknown,
  maxLength = 16384
): string | undefined {
  if (typeof body === "string") {
    return body.length > maxLength ? body.slice(0, maxLength) : body;
  }

  if (isPlainObject(body)) {
    try {
      const serialized = JSON.stringify(body, null, 2);

      return convertRequestBodyToString(serialized, maxLength);
    } catch {
      return undefined;
    }
  }

  return undefined;
}
