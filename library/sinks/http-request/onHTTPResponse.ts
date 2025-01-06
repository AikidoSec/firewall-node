import { IncomingMessage } from "http";
import { Context } from "../../agent/Context";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { tryParseURL } from "../../helpers/tryParseURL";
import { addRedirectToContext } from "../../vulnerabilities/ssrf/addRedirectToContext";

export function onHTTPResponse(
  source: URL,
  res: IncomingMessage,
  context: Context
) {
  if (!res.statusCode || !isRedirectStatusCode(res.statusCode)) {
    return;
  }

  if (typeof res.headers.location !== "string") {
    return;
  }

  const destination = tryParseURL(res.headers.location);
  if (!destination) {
    return;
  }

  addRedirectToContext(source, destination, context);
}
