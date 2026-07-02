import { envToBool } from "./envToBool";

export function isDebuggingSSE() {
  return envToBool(process.env.AIKIDO_DEBUG_SSE);
}
