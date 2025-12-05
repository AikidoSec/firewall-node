/**
 * Check if the argument is treated as an options object by Node.js.
 * For checking if the argument can be used as options for an outgoing HTTP request.
 */
export function isOptionsObject(arg: any): arg is { [key: string]: unknown } {
  return (
    typeof arg === "object" &&
    !Array.isArray(arg) &&
    arg !== null &&
    !(arg instanceof URL)
  );
}
