import type { Dispatcher } from "undici";
import { RequestContextStorage } from "./RequestContextStorage";
import { Context, getContext } from "../../agent/Context";
import { tryParseURL } from "../../helpers/tryParseURL";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { escapeHTML } from "../../helpers/escapeHTML";
import { isRedirectToPrivateIP } from "../../vulnerabilities/ssrf/isRedirectToPrivateIP";
import { wrapOnHeaders } from "./wrapOnHeaders";

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
export function wrapDispatch(orig: Dispatch, agent: Agent): Dispatch {
  return function wrap(opts, handler) {
    const context = getContext();

    if (!context || !opts || !opts.origin || !handler) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    let url: URL | undefined;
    if (typeof opts.origin === "string" && typeof opts.path === "string") {
      url = tryParseURL(opts.origin + opts.path);
    } else if (opts.origin instanceof URL) {
      if (typeof opts.path === "string") {
        url = tryParseURL(opts.origin.href + opts.path);
      } else {
        url = opts.origin;
      }
    }

    if (!url) {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    }

    blockRedirectToPrivateIP(url, context, agent);

    const port = getPortFromURL(url);

    // Wrap onHeaders to check for redirects
    handler.onHeaders = wrapOnHeaders(
      handler.onHeaders,
      { port, url },
      context
    );

    return RequestContextStorage.run({ port, url }, () => {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    });
  };
}

/**
 * Checks if its a redirect to a private IP that originates from a user input and blocks it if it is.
 */
function blockRedirectToPrivateIP(url: URL, context: Context, agent: Agent) {
  const found = isRedirectToPrivateIP(url, context);

  if (found) {
    agent.onDetectedAttack({
      module: "undici",
      operation: "fetch",
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
        `Zen by Aikido has blocked ${attackKindHumanName("ssrf")}: fetch(...) originating from ${found.source}${escapeHTML(found.pathToPayload)}`
      );
    }
  }
}
