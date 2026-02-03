import { envToBool } from "./envToBool";

/**
 * Checks if the current environment is a unit test using tap.
 */
export function isUnitTest() {
  return envToBool(process.env.AIKIDO_UNIT_TESTS);
}
