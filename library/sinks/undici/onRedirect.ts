import { Context, updateContext } from "../../agent/Context";
import { findHostnameInContext } from "../../vulnerabilities/ssrf/findHostnameInContext";
import { getRedirectOrigin } from "../../vulnerabilities/ssrf/getRedirectOrigin";
import type { UndiciRequestContext } from "./RequestContextStorage";

/**
 * Is called by wrapOnHeaders if a request results in a redirect.
 * Check for redirects and store them in the context, if they are originating from user input.
 */
export function onRedirect(
  destination: URL,
  requestContext: UndiciRequestContext,
  context: Context
) {
  let redirectOrigin: URL | undefined;

  // Check if the source hostname is in the context - is true if it's the first redirect in the chain and the user input is the source
  const found = findHostnameInContext(
    requestContext.url.hostname,
    context,
    requestContext.port
  );

  // If the source hostname is not in the context, check if it's a redirect in a already existing chain
  if (!found && context.outgoingRequestRedirects) {
    redirectOrigin = getRedirectOrigin(
      context.outgoingRequestRedirects,
      requestContext.url
    );
  }

  // Get existing redirects or create a new array
  const outgoingRedirects = context.outgoingRequestRedirects || [];

  // If it's 1. a initial redirect with user provided url or 2. a redirect in an existing chain, add it to the context
  if (found || redirectOrigin) {
    outgoingRedirects.push({
      source: requestContext.url,
      destination,
    });

    updateContext(context, "outgoingRequestRedirects", outgoingRedirects);
  }
}
