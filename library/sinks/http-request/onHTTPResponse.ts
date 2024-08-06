import { ClientRequest, IncomingMessage } from "http";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { tryParseURL } from "../../helpers/tryParseURL";
import { Context, updateContext } from "../../agent/Context";
import { findHostnameInContext } from "../../vulnerabilities/ssrf/findHostnameInContext";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { getRedirectOrigin } from "../../vulnerabilities/ssrf/getRedirectOrigin";

export function onHTTPResponse(
  req: ClientRequest,
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

  const source = tryParseURL(req.protocol + "//" + req.host + req.path);
  if (!source) {
    return;
  }

  console.log(source.toString(), "->", destination.toString());
  addRedirectToContext(source, destination, context);
}

function addRedirectToContext(source: URL, destination: URL, context: Context) {
  let redirectOrigin: URL | undefined;

  const sourcePort = getPortFromURL(source);

  let found = findHostnameInContext(source.hostname, context, sourcePort);

  if (!found && context.outgoingRequestRedirects) {
    redirectOrigin = getRedirectOrigin(
      context.outgoingRequestRedirects,
      source
    );

    if (redirectOrigin) {
      found = findHostnameInContext(
        redirectOrigin.hostname,
        context,
        getPortFromURL(redirectOrigin)
      );
    }
  }

  const outgoingRedirects = context.outgoingRequestRedirects || [];

  if (redirectOrigin || found) {
    outgoingRedirects.push({
      source,
      destination,
    });

    updateContext(context, "outgoingRequestRedirects", outgoingRedirects);
    console.log(outgoingRedirects);
  }
}
