import { Context, getContext } from "../../agent/Context";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { tryParseURL } from "../../helpers/tryParseURL";

/**
 * Wrap a http2 response handler to get the response headers
 */
export function wrapResponseHandler(origHandler: Function, url: URL) {
  return function responseHandler() {
    const context = getContext();
    if (context) {
      const args = Array.from(arguments);
      if (args.length > 0 && typeof args[0] === "object" && args[0] !== null) {
        onHTTP2Response(args[0], url, context);
      }
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
  url: URL,
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

  // Todo add to context
}
