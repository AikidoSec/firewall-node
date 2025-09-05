import { envToBool } from "./envToBool";

export function isNewInstrumentationUnitTest(): boolean {
  return envToBool(process.env.AIKIDO_TEST_NEW_INSTRUMENTATION);
}
