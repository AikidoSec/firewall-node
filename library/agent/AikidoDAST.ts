import { Context } from "./Context";

const AIKIDO_DAST_HEADER = "aikido-api-test";

export function isAikidoDASTRequest(context: Context) {
  return context.headers[AIKIDO_DAST_HEADER] === "1";
}
