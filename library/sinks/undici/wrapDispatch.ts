import type { Dispatcher } from "undici";
import { RequestContextStorage } from "./RequestContextStorage";
import { getContext, updateContext } from "../../agent/Context";
import { tryParseURL } from "../../helpers/tryParseURL";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import { parseHeaders } from "./parseHeaders";
import { containsPrivateIPAddress } from "../../vulnerabilities/ssrf/containsPrivateIPAddress";
import { findHostnameInContext } from "../../vulnerabilities/ssrf/findHostnameInContext";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { escapeHTML } from "../../helpers/escapeHTML";
import { getRedirectOriginHostname } from "../../vulnerabilities/ssrf/getRedirectOriginHostname";

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

    // Wrap onHeaders to check for redirects
    handler.onHeaders = wrapOnHeaders(handler.onHeaders, agent);

    const port = getPortFromURL(url);
    return RequestContextStorage.run({ port, url }, () => {
      return orig.apply(
        // @ts-expect-error We dont know the type of this
        this,
        [opts, handler]
      );
    });
  };
}

function wrapOnHeaders(orig: OnHeaders, agent: Agent): OnHeaders {
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

              onRedirect(url, requestContext, agent);
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

function onRedirect(
  destination: URL,
  requestContext: ReturnType<typeof RequestContextStorage.getStore>,
  agent: Agent
) {
  if (!requestContext) {
    return;
  }
  console.log(
    `Redirect: ${requestContext.url.toString()} -> ${destination.toString()}`
  );

  const context = getContext();
  if (!context) {
    return;
  }

  let redirectOriginHostname: string | undefined;

  let found = findHostnameInContext(
    requestContext.url.hostname,
    context,
    requestContext.port
  );

  if (!found && context.outgoingRequestRedirects) {
    redirectOriginHostname = getRedirectOriginHostname(
      context.outgoingRequestRedirects,
      requestContext.url
    );

    if (redirectOriginHostname) {
      found = findHostnameInContext(
        redirectOriginHostname,
        context,
        requestContext.port
      );
    }
  }

  if (found && containsPrivateIPAddress(destination.hostname)) {
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
      // Todo does not block the redirect
      console.log(`SSRF redirect to ip should get blocked here`);
      throw new Error(
        `Aikido firewall has blocked ${attackKindHumanName("ssrf")}: fetch(...) originating from ${found.source}${escapeHTML(found.pathToPayload)}`
      );
    }
  }

  const outgoingRedirects = context.outgoingRequestRedirects || [];

  if (redirectOriginHostname || found) {
    console.log(
      `Adding redirect to context ${requestContext.url} -> ${destination}`
    );
    outgoingRedirects.push({
      source: requestContext.url,
      destination,
    });

    updateContext(context, "outgoingRequestRedirects", outgoingRedirects);
  }
}
