import type { Dispatcher } from "undici";
import { RequestContextStorage } from "./RequestContextStorage";
import { Context, getContext, updateContext } from "../../agent/Context";
import { tryParseURL } from "../../helpers/tryParseURL";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { parseHeaders } from "./parseHeaders";
import { containsPrivateIPAddress } from "../../vulnerabilities/ssrf/containsPrivateIPAddress";
import { findHostnameInContext } from "../../vulnerabilities/ssrf/findHostnameInContext";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { escapeHTML } from "../../helpers/escapeHTML";
import { getRedirectOrigin } from "../../vulnerabilities/ssrf/getRedirectOrigin";

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
export function wrapDispatch(orig: Dispatch, agent: Agent): Dispatch {
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

    const port = getPortFromURL(url);

    if (
      context.outgoingRequestRedirects &&
      containsPrivateIPAddress(url.hostname)
    ) {
      const redirectOrigin = getRedirectOrigin(
        context.outgoingRequestRedirects,
        url
      );

      if (redirectOrigin) {
        const found = findHostnameInContext(
          redirectOrigin.hostname,
          context,
          parseInt(redirectOrigin.port, 10)
        );

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
              `Aikido firewall has blocked ${attackKindHumanName("ssrf")}: fetch(...) originating from ${found.source}${escapeHTML(found.pathToPayload)}`
            );
          }
        }
      }
    }

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

function wrapOnHeaders(
  orig: OnHeaders,
  requestContext: ReturnType<typeof RequestContextStorage.getStore>,
  context: Context
): OnHeaders {
  // @ts-expect-error We return undefined if there is no original function, thats fine because the onHeaders function is optional
  return function onHeaders() {
    // eslint-disable-next-line prefer-rest-params
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
        } catch (e) {
          // Ignore, log later if we have log levels
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

function onRedirect(
  destination: URL,
  requestContext: ReturnType<typeof RequestContextStorage.getStore>,
  context: Context
) {
  if (!requestContext) {
    return;
  }

  let redirectOrigin: URL | undefined;

  let found = findHostnameInContext(
    requestContext.url.hostname,
    context,
    requestContext.port
  );

  if (!found && context.outgoingRequestRedirects) {
    redirectOrigin = getRedirectOrigin(
      context.outgoingRequestRedirects,
      requestContext.url
    );

    if (redirectOrigin) {
      found = findHostnameInContext(
        redirectOrigin.hostname,
        context,
        parseInt(redirectOrigin.port, 10)
      );
    }
  }

  const outgoingRedirects = context.outgoingRequestRedirects || [];

  if (redirectOrigin || found) {
    outgoingRedirects.push({
      source: requestContext.url,
      destination,
    });

    updateContext(context, "outgoingRequestRedirects", outgoingRedirects);
  }
}
