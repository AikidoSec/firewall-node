import { Context, getContext, updateContext } from "../../agent/Context";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { tryParseURL } from "../../helpers/tryParseURL";
import { findHostnameInContext } from "../../vulnerabilities/ssrf/findHostnameInContext";
import { getRedirectOrigin } from "../../vulnerabilities/ssrf/getRedirectOrigin";

/**
 * Wrap a http2 response handler to get the response headers
 */
export function wrapResponseHandler(
  origHandler: Function,
  url: URL,
  context: Context
) {
  return function responseHandler() {
    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);
    if (args.length > 0 && typeof args[0] === "object" && args[0] !== null) {
      onHTTP2Response(args[0], url, context);
    }

    return origHandler.apply(
      // @ts-expect-error We don't know the type of `this`
      this,
      // eslint-disable-next-line prefer-rest-params
      arguments
    );
  };
}

/**
 * Check if response is a redirect and add to context
 */
function onHTTP2Response(
  headers: Record<string, string>,
  source: URL,
  context: Context
) {
  const statusCode = headers[":status"];

  if (typeof statusCode !== "number" || !isRedirectStatusCode(statusCode)) {
    return;
  }

  const destination = tryParseURL(headers.location);
  if (!destination) {
    return;
  }

  addRedirectToContext(source, destination, context);
}

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
