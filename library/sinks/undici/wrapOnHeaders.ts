import { RequestContextStorage } from "./RequestContextStorage";
import { parseHeaders } from "./parseHeaders";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import type { Dispatcher } from "undici-v6";
import type { Dispatcher as DispatcherV8 } from "undici-v8";
import { Context } from "../../agent/Context";
import { onRedirect } from "./onRedirect";

type OnHeaders = Dispatcher.DispatchHandlers["onHeaders"];
type OnResponseStart = DispatcherV8.DispatchHandler["onResponseStart"];

/**
 * Wrap the onHeaders function and check if the response is a redirect. If yes, determine the destination URL and call onRedirect.
 * This is the undici v6 / legacy handler API
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

/**
 * Wrap the onResponseStart function (undici v7 / Node.js v26+ handler API) and check if the response is a redirect.
 * Headers are passed as a plain object with lowercase keys instead of a Buffer array.
 */
export function wrapOnResponseStart(
  orig: OnResponseStart,
  requestContext: ReturnType<typeof RequestContextStorage.getStore>,
  context: Context
): OnResponseStart {
  return function onResponseStart(_controller, statusCode, headers) {
    if (isRedirectStatusCode(statusCode)) {
      try {
        const location = headers?.location;
        if (typeof location === "string") {
          const destinationUrl = new URL(location);
          onRedirect(destinationUrl, requestContext, context);
        }
      } catch {
        // Ignore, log later if we have log levels
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
