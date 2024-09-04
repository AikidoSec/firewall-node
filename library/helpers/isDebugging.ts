/**
 * Checks if AIKIDO_DEBUG is set to true or 1
 */
export function isDebugging() {
  return (
    process.env.AIKIDO_DEBUG === "true" || process.env.AIKIDO_DEBUG === "1"
  );
}
