import type { Dispatcher } from "undici";
import { RequestContextStorage } from "./RequestContextStorage";
import { getContext } from "../../agent/Context";
import { tryParseURL } from "../../helpers/tryParseURL";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { parseHeaders } from "./parseHeaders";
import { containsPrivateIPAddress } from "../../vulnerabilities/ssrf/containsPrivateIPAddress";

type Dispatch = Dispatcher["dispatch"];
type OnHeaders = Dispatcher.DispatchHandlers["onHeaders"];

/**
 * Wraps the dispatch function of the undici client to store the port of the request in the context.
 * This is needed to prevent false positives for SSRF vulnerabilities.
 * At a dns request, the port is not known, so we need to store it in the context to prevent the following scenario:
 * 1. Userinput includes localhost:4000 in the host header, because the application is running on port 4000
 * 2. The application makes a fetch request to localhost:5000 - this would be blocked as SSRF, because the port is not known
 *
 * We can not store the port in the context directly inside our inspect functions, because the order in which the requests are made is not guaranteed.
 * So for example if Promise.all is used, the dns request for one request could be made after the fetch request of another request.
 */
export function wrapDispatch(orig: Dispatch): Dispatch {
  return function wrap(opts, handler) {
    const context = getContext();

    // If there is no context, we don't need to do anything special
    if (!context) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    if (!opts || !opts.origin) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    // Wrap onHeaders to check for redirects
    handler.onHeaders = wrapOnHeaders(handler.onHeaders);

    let url: URL | undefined;
    if (typeof opts.origin === "string") {
      url = tryParseURL(opts.origin);
    } else if (opts.origin instanceof URL) {
      url = opts.origin;
    }

    if (!url) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    const port = getPortFromURL(url);

    console.log("-> RequestContextStorage.run", url.hostname, port);

    return RequestContextStorage.run({ port, hostname: url.hostname }, () => {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    });
  };
}

function wrapOnHeaders(orig: OnHeaders): OnHeaders {
  return function onHeaders() {
    const args = Array.from(arguments);

    if (args.length > 1) {
      const statusCode = args[0];
      if (isRedirectStatusCode(statusCode)) {
        const requestContext = RequestContextStorage.getStore();
        if (requestContext) {
          try {
            // Get redirect location
            const headers = parseHeaders(args[1]);
            if (typeof headers.location === "string") {
              const url = new URL(headers.location);

              if (containsPrivateIPAddress(url.hostname)) {
                // Todo block
              }

              requestContext.redirected = true;

              console.log("Setting redirected", url.hostname, url.port);
            }
          } catch (e) {
            // Todo log?
          }
        }
      }
    }

    if (orig) {
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
