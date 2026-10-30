import type { IncomingMessage } from "http";
import { Context, updateContext } from "../../agent/Context";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { normalizeHostname } from "../../helpers/normalizeHostname";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { findHostnameInContext } from "../../vulnerabilities/ssrf/findHostnameInContext";
import { getRedirectOrigin } from "../../vulnerabilities/ssrf/getRedirectOrigin";

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

  // The location can be relative (/path) or protocol-relative (//host/path)
  let destination: URL;
  try {
    destination = new URL(res.headers.location, source);
  } catch {
    return;
  }

  source.hostname = normalizeHostname(source.hostname);
  destination.hostname = normalizeHostname(destination.hostname);

  addRedirectToContext(source, destination, context);
}

/**
 * Adds redirects with user provided hostname / url to the context to prevent SSRF attacks with redirects.
 */
function addRedirectToContext(source: URL, destination: URL, context: Context) {
  let redirectOrigin: URL | undefined;

  const sourcePort = getPortFromURL(source);

  const found = findHostnameInContext(source.hostname, context, sourcePort);

  // If the source hostname is not in the context, check if it's a redirect in an already existing chain
  if (!found && context.outgoingRequestRedirects) {
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

  const alreadyAdded = outgoingRedirects.some(
    (r) =>
      r.source.href === source.href && r.destination.href === destination.href
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
