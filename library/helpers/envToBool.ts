const trueValues = ["true", "1", "yes", "y", "on"];

export function envToBool(env: string | undefined): boolean {
  if (!env) {
    return false;
  }
  return trueValues.includes(env.toLowerCase());
}
