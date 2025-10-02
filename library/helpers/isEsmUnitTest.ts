import { envToBool } from "./envToBool";

export function isEsmUnitTest(): boolean {
  return envToBool(process.env.AIKIDO_ESM_TEST);
}
