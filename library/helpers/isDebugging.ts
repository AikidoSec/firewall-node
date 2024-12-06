import { envToBool } from "./envToBool";

/**
 * Checks if AIKIDO_DEBUG is set to true or 1
 */
export function isDebugging() {
  return envToBool(process.env.AIKIDO_DEBUG);
}
