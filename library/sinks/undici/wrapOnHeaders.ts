/* eslint-disable max-lines-per-function */
import type { UndiciRequestContext } from "./RequestContextStorage";
import { parseHeaders } from "./parseHeaders";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import type { Dispatcher } from "undici";
import { Context } from "../../agent/Context";
import { onRedirect } from "./onRedirect";
import { getUrlFromOptions } from "./getUrlFromOptions";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { wrapDispatch } from "./wrapDispatch";
import { getInstance } from "../../agent/AgentSingleton";

type OnHeaders = Dispatcher.DispatchHandlers["onHeaders"];

/**
 * Wrap the onHeaders function and check if the response is a redirect. If yes, determine the destination URL and call onRedirect.
 */
export function wrapOnHeaders(
  orig: OnHeaders,
  requestContext: UndiciRequestContext | undefined,
  context: Context,
  isRedirectHandler = false // True if undici is used directly with a redirect handler
): OnHeaders {
  // @ts-expect-error We return undefined if there is no original function, thats fine because the onHeaders function is optional
  return function onHeadersWrapped() {
    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);

    // Request context is required, but not set if it's a direct undici request with a redirect handler (not fetch)
    // In this case, we get the request url from the class object that contains the onHeaders function we are wrapping
    // @ts-expect-error No types for this
    if (isRedirectHandler && typeof this.opts === "object") {
      // @ts-expect-error No types for this
      const url = getUrlFromOptions(this.opts);
      if (url) {
        requestContext = { port: getPortFromURL(url), url };

        const agent = getInstance();
        if (agent) {
          // Wrap dispatch of redirect handler to set the request context for dns lookups and check for SSRF with private IPs
          // We also pass the context because the AsyncLocalStorage context is broken after a redirect
          // @ts-expect-error No types for this
          this.dispatch = wrapDispatch(this.dispatch, agent, false, context);
        }
      }
    }

    if (requestContext && args.length > 1) {
      const statusCode = args[0];
      if (isRedirectStatusCode(statusCode)) {
        try {
          // Get redirect location
          const headers = parseHeaders(args[1]);
          if (typeof headers.location === "string") {
            const destinationUrl = new URL(headers.location);
            onRedirect(destinationUrl, requestContext, context);
          }
        } catch (e) {
          // Ignore, log later if we have log levels
        }
      }
    }

    if (typeof orig === "function") {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        // @ts-expect-error Arguments are not typed
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    }
  };
}
