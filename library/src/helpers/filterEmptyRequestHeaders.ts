import { Context } from "../agent/Context";

export function filterEmptyRequestHeaders(
  headers: Context["headers"]
): Record<string, string | string[]> {
  const normalized: Record<string, string | string[]> = {};
  for (const key in headers) {
    const value = headers[key];

    if (Array.isArray(value) && value.length > 0) {
      normalized[key] = value;
    }

    if (typeof value === "string" && value.length > 0) {
      normalized[key] = value;
    }
  }

  return normalized;
}
