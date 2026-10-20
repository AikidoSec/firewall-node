const trueValues = ["true", "1", "yes", "y", "on"];

/**
 * Parses the string value of an environment variable to a boolean.
 */
export function envToBool(env: string | undefined): boolean {
  if (!env) {
    return false;
  }
  return trueValues.includes(env.toLowerCase());
}
