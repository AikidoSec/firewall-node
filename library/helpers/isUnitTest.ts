/**
 * Checks if the current environment is a unit test using tap.
 */
export function isUnitTest() {
  return process.env.TAP === "1";
}
