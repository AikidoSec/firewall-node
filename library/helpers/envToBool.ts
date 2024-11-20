const trueValues = ["true", "1", "yes", "y", "on"];

/**
 * Parses the string value of an environment variable to a boolean.
 */
export function envToBool(envName: string | undefined): boolean {
  if (!envName) {
    return false;
  }
  return trueValues.includes(envName.toLowerCase());
}
