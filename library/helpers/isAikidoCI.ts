import { envToBool } from "./envToBool";

export function isAikidoCI(): boolean {
  return envToBool(process.env.AIKIDO_CI);
}
