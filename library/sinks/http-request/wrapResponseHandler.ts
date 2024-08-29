import { IncomingMessage } from "http";
import { Context, getContext, updateContext } from "../../agent/Context";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { tryParseURL } from "../../helpers/tryParseURL";
import { findHostnameInContext } from "../../vulnerabilities/ssrf/findHostnameInContext";
import { getRedirectOrigin } from "../../vulnerabilities/ssrf/getRedirectOrigin";
import { getUrlFromHTTPRequestArgs } from "./getUrlFromHTTPRequestArgs";

/**
 * We are wrapping the response handler for outgoing HTTP requests to detect redirects.
 * If the response is a redirect, we will add the redirect to the context to be able to detect SSRF attacks with redirects.
 */
export function wrapResponseHandler(
  args: unknown[],
  module: "http" | "https",
  fn: Function
) {
  return function responseHandler(res: IncomingMessage) {
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

/**
 * Adds redirects with user provided hostname / url to the context to prevent SSRF attacks with redirects.
 */
function addRedirectToContext(source: URL, destination: URL, context: Context) {
  let redirectOrigin: URL | undefined;

  const sourcePort = getPortFromURL(source);

  // Check if the source hostname is in the context - is true if it's the first redirect in the chain and the user input is the source
  const found = findHostnameInContext(source.hostname, context, sourcePort);

  // If the source hostname is not in the context, check if it's a redirect in an already existing chain
  if (!found && context.outgoingRequestRedirects) {
    // Get initial source of the redirect chain (first redirect), if url is part of a redirect chain
    redirectOrigin = getRedirectOrigin(
      context.outgoingRequestRedirects,
      source
    );
  }

  // If it's 1. an initial redirect with user provided url or 2. a redirect in an existing chain, add it to the context
  if (found || redirectOrigin) {
    addRedirectToChain(source, destination, context);
  }
}

function addRedirectToChain(source: URL, destination: URL, context: Context) {
  const outgoingRedirects = context.outgoingRequestRedirects || [];
  const alreadyAdded = outgoingRedirects.find(
    (r) =>
      r.source.toString() === source.toString() &&
      r.destination.toString() === destination.toString()
  );

  if (alreadyAdded) {
    return;
  }

  outgoingRedirects.push({
    source,
    destination,
  });

  updateContext(context, "outgoingRequestRedirects", outgoingRedirects);
}
