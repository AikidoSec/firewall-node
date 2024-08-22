/**
 * Check if the argument is treated as an options object by Node.js.
 */
export function isOptionsObjects(arg: any): arg is { [key: string]: unknown } {
  if (typeof arg !== "object" || Array.isArray(arg) || arg === null) {
    return false;
  }

  return true;
}
