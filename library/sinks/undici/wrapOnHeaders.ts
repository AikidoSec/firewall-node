import { RequestContextStorage } from "./RequestContextStorage";
import { parseHeaders } from "./parseHeaders";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import type { Dispatcher } from "undici-v6";
import { Context } from "../../agent/Context";
import { onRedirect } from "./onRedirect";

type OnHeaders = Dispatcher.DispatchHandlers["onHeaders"];

/**
 * Wrap the onHeaders function and check if the response is a redirect. If yes, determine the destination URL and call onRedirect.
 */
export function wrapOnHeaders(
  orig: OnHeaders,
  requestContext: ReturnType<typeof RequestContextStorage.getStore>,
  context: Context
): OnHeaders {
  // @ts-expect-error We return undefined if there is no original function, that's fine because the onHeaders function is optional
  return function onHeaders() {
    const args = Array.from(arguments);

    if (args.length > 1) {
      const statusCode = args[0];
      if (isRedirectStatusCode(statusCode)) {
        try {
          // Get redirect location
          const headers = parseHeaders(args[1]);
          if (typeof headers.location === "string") {
            const destinationUrl = new URL(headers.location);

            onRedirect(destinationUrl, requestContext, context);
          }
        } catch {
          // Ignore, log later if we have log levels
        }
      }
    }

    if (orig) {
      return orig.apply(
        // @ts-expect-error We don't know the type of this
        this,
        // @ts-expect-error Arguments are not typed
        arguments
      );
    }
  };
}
