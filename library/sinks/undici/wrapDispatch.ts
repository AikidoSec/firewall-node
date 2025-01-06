/* eslint-disable max-lines-per-function */
import type { Dispatcher } from "undici-v6";
import { runWithUndiciRequestContext } from "./RequestContextStorage";
import { getMetadataForSSRFAttack } from "../../vulnerabilities/ssrf/getMetadataForSSRFAttack";
import { Context, getContext } from "../../agent/Context";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { escapeHTML } from "../../helpers/escapeHTML";
import { isRedirectToPrivateIP } from "../../vulnerabilities/ssrf/isRedirectToPrivateIP";
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
  contextArg?: Context // Only set if its a nth dispatch after a redirect
): Dispatch {
  return function wrap(opts, handler) {
    let context: Context | undefined;

    // Prefer passed context over the context from the async local storage
    // Context is passed as arg if its a nth dispatch after a redirect
    if (contextArg) {
      context = contextArg;
    } else {
      context = getContext();
    }

    if (!context || !opts || !opts.origin || !handler) {
      return orig.apply(
        // @ts-expect-error We don't know the type of this
        this,
        [opts, handler]
      );
    }

    const url = getUrlFromOptions(opts);

    if (!url) {
      return orig.apply(
        // @ts-expect-error We don't know the type of this
        this,
        [opts, handler]
      );
    }

    blockRedirectToPrivateIP(url, context, agent, isFetch);

    // We also pass the incoming context as part of the outgoing request context to prevent context mismatch, if the request is a redirect (argContext is set)
    return runWithUndiciRequestContext(
      {
        port: getPortFromURL(url),
        url,
        isFetch,
        inContext: contextArg,
      },
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
 * Checks if it's a redirect to a private IP that originates from a user input and blocks it if it is.
 */
function blockRedirectToPrivateIP(
  url: URL,
  context: Context,
  agent: Agent,
  isFetch: boolean
) {
  const isAllowedIP =
    context &&
    context.remoteAddress &&
    agent.getConfig().isAllowedIP(context.remoteAddress);

  if (isAllowedIP) {
    // If the IP address is allowed, we don't need to block the request
    return;
  }

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
      paths: found.pathsToPayload,
      metadata: getMetadataForSSRFAttack({
        hostname: found.hostname,
        port: found.port,
      }),
      request: context,
      payload: found.payload,
    });

    if (agent.shouldBlock()) {
      throw new Error(
        `Zen has blocked ${attackKindHumanName("ssrf")}: ${operation}(...) originating from ${found.source}${escapeHTML((found.pathsToPayload || []).join())}`
      );
    }
  }
}
