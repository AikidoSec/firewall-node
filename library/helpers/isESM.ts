/**
 * Checks at runtime if the Node.js application is using ESM.
 * As it depends on the stack trace, it should be used directly after the file got imported / at top level of the library.
 */
export function isESM() {
  // Save current stack trace limit and increase it a bit, to make sure we don't get too few frames
  const currentStackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 15;

  // Capture the current stack trace
  const stack = new Error().stack || "";

  // Reset stack trace limit
  Error.stackTraceLimit = currentStackTraceLimit;

  return stack.includes("node:internal/modules/esm/loader:");
}
