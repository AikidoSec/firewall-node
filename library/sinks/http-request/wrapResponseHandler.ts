import { IncomingMessage } from "http";
import { Context, getContext, updateContext } from "../../agent/Context";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { tryParseURL } from "../../helpers/tryParseURL";
import { findHostnameInContext } from "../../vulnerabilities/ssrf/findHostnameInContext";
import { getRedirectOrigin } from "../../vulnerabilities/ssrf/getRedirectOrigin";
import { getUrlFromHTTPRequestArgs } from "./getUrlFromHTTPRequestArgs";

export function wrapResponseHandler(
  args: unknown[],
  module: "http" | "https",
  fn: Function
) {
  return function responseHandler(res: IncomingMessage) {
    // Need to attach data & end event handler otherwise the response will never end
    // And the process will keep running...
    if (res.rawListeners("data").length === 0) {
      res.on("data", () => {});
    }

    if (res.rawListeners("end").length === 0) {
      res.on("end", () => {});
    }

    const context = getContext();
    if (context) {
      onHTTPResponse(args, module, res, context);
    }

    // eslint-disable-next-line prefer-rest-params
    fn(...arguments);
  };
}

function onHTTPResponse(
  args: unknown[],
  module: "http" | "https",
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

  const source = getUrlFromHTTPRequestArgs(args, module);
  if (!source) {
    return;
  }

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
  }
}
