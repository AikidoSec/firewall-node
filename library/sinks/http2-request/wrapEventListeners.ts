import type { ClientHttp2Stream } from "http2";
import { wrapDefaultOrNamed } from "../../agent/hooks/wrapDefaultOrNamed";
import { wrapResponseHandler } from "./wrapResponseHandler";

/**
 * Wrap event listeners of a http2 stream to check for redirects on response and headers events (SSRF redirect protection)
 */
export function wrapEventListeners(stream: ClientHttp2Stream, url: URL) {
  const methods = [
    "on",
    "addListener",
    "once",
    "prependListener",
    "prependOnceListener",
  ];

  for (const method of methods) {
    wrapDefaultOrNamed(stream, method, function createWrappedOn(original) {
      return function wrappedOn(this: ClientHttp2Stream) {
        // eslint-disable-next-line prefer-rest-params
        const args = Array.from(arguments);

        if (args.length === 2 && typeof args[1] === "function") {
          // Only wrap response and headers events
          if (args[0] === "response" || args[0] === "headers") {
            const requestArgs = [args[0], stream];

            const responseHandler = args[1];
            args[1] = wrapResponseHandler(responseHandler, url);

            return original.apply(this, args);
          }
        }

        // eslint-disable-next-line prefer-rest-params
        return original.apply(this, arguments);
      };
    });
  }
}
