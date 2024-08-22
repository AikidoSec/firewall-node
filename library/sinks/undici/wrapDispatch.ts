import type { Dispatcher } from "undici";
import { RequestContextStorage } from "./RequestContextStorage";
import { Context, getContext } from "../../agent/Context";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { escapeHTML } from "../../helpers/escapeHTML";
import { isRedirectToPrivateIP } from "../../vulnerabilities/ssrf/isRedirectToPrivateIP";
import { wrapOnHeaders } from "./wrapOnHeaders";
import { getUrlFromOptions } from "./getUrlFromOptions";

type Dispatch = Dispatcher["dispatch"];

/**
 * Wraps the dispatch function of the undici client to store the port of the request in the context.
 * This is needed to prevent false positives for SSRF vulnerabilities.
 * At a dns request, the port is not known, so we need to store it in the context to prevent the following scenario:
 * 1. Userinput includes localhost:4000 in the host header, because the application is running on port 4000
 * 2. The application makes a fetch request to localhost:5000 - this would be blocked as SSRF, because the port is not known
 *
 * We can not store the port in the context directly inside our inspect functions, because the order in which the requests are made is not guaranteed.
 * So for example if Promise.all is used, the dns request for one request could be made after the fetch request of another request.
 *
 */
export function wrapDispatch(
  orig: Dispatch,
  agent: Agent,
  isFetch: boolean,
  contextArg?: Context
): Dispatch {
  return function wrap(opts, handler) {
    let context = getContext();

    // Prefer passed context over the context from the async local storage
    if (contextArg) {
      context = contextArg;
    }

    if (!context || !opts || !opts.origin || !handler) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    const url = getUrlFromOptions(opts);

    if (!url) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    blockRedirectToPrivateIP(url, context, agent, isFetch);

    const port = getPortFromURL(url);

    // Wrap onHeaders to check for redirects
    handler.onHeaders = wrapOnHeaders(
      handler.onHeaders,
      { port, url },
      context
    );

    const requestContext = RequestContextStorage.getStore();
    if (requestContext) {
      // Request context is already set if this is a redirect, so we have to modify it
      // We also pass the incoming context as part of the outgoing request context to prevent context mismatch
      requestContext.port = port;
      requestContext.url = url;
      requestContext.inContext = contextArg;
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    return RequestContextStorage.run(
      { port, url, isFetch, inContext: undefined },
      () => {
        return orig.apply(
          // @ts-expect-error We dont know the type of this
          this,
          [opts, handler]
        );
      }
    );
  };
}

/**
 * Checks if its a redirect to a private IP that originates from a user input and blocks it if it is.
 */
function blockRedirectToPrivateIP(
  url: URL,
  context: Context,
  agent: Agent,
  isFetch: boolean
) {
  const found = isRedirectToPrivateIP(url, context);

  const operation = isFetch ? "fetch" : "undici.[method]";

  if (found) {
    agent.onDetectedAttack({
      module: "undici",
      operation: operation,
      kind: "ssrf",
      source: found.source,
      blocked: agent.shouldBlock(),
      stack: new Error().stack!,
      path: found.pathToPayload,
      metadata: {},
      request: context,
      payload: found.payload,
    });

    if (agent.shouldBlock()) {
      throw new Error(
        `Aikido firewall has blocked ${attackKindHumanName("ssrf")}: ${operation}(...) originating from ${found.source}${escapeHTML(found.pathToPayload)}`
      );
    }
  }
}
