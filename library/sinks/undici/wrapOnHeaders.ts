import { parseHeaders } from "./parseHeaders";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { addRedirectToContext } from "../../vulnerabilities/ssrf/addRedirectToContext";
import { Context, getContext } from "../../agent/Context";
import type { Dispatcher } from "undici-v6";
import { getUrlFromOptions } from "./getUrlFromOptions";

type OnHeaders = Dispatcher.DispatchHandlers["onHeaders"];

/**
 * Check if the response is a redirect. If yes, determine the destination URL.
 */
export function wrapOnHeaders(
  orig: OnHeaders,
  context: Context,
  requestUrl?: URL
): OnHeaders {
  // @ts-expect-error We return undefined if there is no original function, thats fine because the onHeaders function is optional
  return function onHeaders() {
    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);

    try {
      let sourceURL = requestUrl;
      if (!sourceURL) {
        // @ts-expect-error No types for this
        sourceURL = getUrlFromOptions(this.opts);
      }

      if (sourceURL) {
        const destinationUrl = getRedirectDestination(args, sourceURL);
        if (destinationUrl) {
          addRedirectToContext(sourceURL, destinationUrl, context);
        }
      }
    } catch {
      // Log if we have a logger with log levels
    }

    // It's a optional function, so we need to check if it was originally defined
    if (typeof orig === "function") {
      return orig.apply(
        // @ts-expect-error We don't know the type of this
        this,
        // @ts-expect-error Arguments are not typed
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    }
  };
}

function getRedirectDestination(
  args: unknown[],
  sourceURL: URL
): URL | undefined {
  const statusCode = args[0];

  // Check if the response is a redirect
  if (typeof statusCode !== "number" || !isRedirectStatusCode(statusCode)) {
    return;
  }

  // Get redirect destination
  const headers = parseHeaders(args[1] as any);
  if (typeof headers.location !== "string") {
    return;
  }

  // Get the destination URL
  return parseLocationHeader(headers.location, sourceURL.origin);
}

// The location header can be an absolute or relative URL
function parseLocationHeader(header: string, origin: string) {
  if (header.startsWith("/")) {
    return new URL(header, origin);
  }
  return new URL(header);
}
