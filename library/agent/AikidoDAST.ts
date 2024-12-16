import { isPlainObject } from "../helpers/isPlainObject";
import { Context } from "./Context";

const AIKIDO_DAST_HEADER = "aikido-api-test";

export function isAikidoDASTRequest(context: Context) {
  return (
    isPlainObject(context.headers) &&
    AIKIDO_DAST_HEADER in context.headers &&
    context.headers[AIKIDO_DAST_HEADER] === "1"
  );
}
