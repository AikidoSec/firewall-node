import { envToBool } from "./envToBool";

export function shouldInstrument() {
  return envToBool(process.env.AIKIDO_INSTRUMENT);
}
