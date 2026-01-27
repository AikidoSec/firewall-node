/**
 * Checks if the current environment is a unit test using tap.
 */
export function isUnitTest() {
  return process.env.AIKIDO_UNIT_TESTS === "1";
}
