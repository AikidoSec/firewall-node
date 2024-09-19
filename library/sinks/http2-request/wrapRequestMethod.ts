import type { ClientHttp2Session, ClientHttp2Stream } from "http2";
import { getUrlFromRequest } from "./getUrlFromRequest";
import { wrapEventListeners } from "./wrapEventListeners";
import { Context } from "../../agent/Context";
import { isRedirectToPrivateIP } from "../../vulnerabilities/ssrf/isRedirectToPrivateIP";
import { attackKindHumanName } from "../../agent/Attack";
import { escapeHTML } from "../../helpers/escapeHTML";
import { Agent } from "../../agent/Agent";

/**
 * Wrap .request method of a http2 client
 */
export function wrapRequestMethod(
  subject: ClientHttp2Session,
  context: Context,
  agent: Agent
) {
  const orig = subject.request;

  return function wrapped(this: ClientHttp2Session) {
    const applyOriginal = () =>
      orig.apply(
        this,
        // @ts-expect-error Not type safe
        // eslint-disable-next-line prefer-rest-params
        arguments
      );

    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);

    const headers = args.length > 0 ? args[0] : {};
    const url = getUrlFromRequest(subject, headers);

    if (url) {
      preventRedirectToPrivateIP(url, context, agent);
    }

    const stream = applyOriginal() as ClientHttp2Stream;

    if (url && typeof stream === "object" && stream !== null) {
      wrapEventListeners(stream, url, context);
    }

    return stream;
  };
}

/**
 * Check if it's a ssrf redirect and prevent it
 */
function preventRedirectToPrivateIP(url: URL, context: Context, agent: Agent) {
  // Check if the hostname is a private IP and if it's a redirect that was initiated by user input
  const foundSSRFRedirect = isRedirectToPrivateIP(url, context);
  if (foundSSRFRedirect) {
    agent.onDetectedAttack({
      module: "http2",
      operation: "request",
      kind: "ssrf",
      source: foundSSRFRedirect.source,
      blocked: agent.shouldBlock(),
      stack: new Error().stack!,
      path: foundSSRFRedirect.pathToPayload,
      metadata: {
        hostname: url.hostname,
      },
      request: context,
      payload: foundSSRFRedirect.payload,
    });

    if (agent.shouldBlock()) {
      throw new Error(
        `Aikido firewall has blocked ${attackKindHumanName("ssrf")}: http2.request(...) originating from ${foundSSRFRedirect.source}${escapeHTML(foundSSRFRedirect.pathToPayload)}`
      );
    }
  }
}
