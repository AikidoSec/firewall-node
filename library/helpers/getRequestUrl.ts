import type { IncomingMessage } from "http";
import { Http2ServerRequest } from "http2";
import type { TLSSocket } from "tls";
import { trustProxy } from "./trustProxy";

/**
 * Get the full request URL including protocol and host.
 * Falls back to relative URL if host is not available.
 * Also respects forwarded headers if proxies are trusted.
 */
export function getRequestUrl(
  req: IncomingMessage | Http2ServerRequest
): string {
  const reqUrl = req.url || "";

  // Already absolute URL
  if (
    reqUrl[0] !== "/" && // performance improvement
    (reqUrl.startsWith("http://") || reqUrl.startsWith("https://"))
  ) {
    return reqUrl;
  }

  // Relative URL
  const host = getHost(req);
  if (!host) {
    // Fallback to relative URL if host is not available
    return reqUrl;
  }

  // Determine protocol, fallback to http if not detectable
  const protocol = getProtocol(req);

  if (reqUrl.length && !reqUrl.startsWith("/")) {
    // Ensure there's a slash between host and path
    return `${protocol}://${host}/${reqUrl}`;
  }

  return `${protocol}://${host}${reqUrl}`;
}

function getHost(
  req: IncomingMessage | Http2ServerRequest
): string | undefined {
  const forwardedHost = req.headers?.["x-forwarded-host"];

  if (typeof forwardedHost === "string" && trustProxy()) {
    return forwardedHost;
  }

  const host =
    req instanceof Http2ServerRequest ? req.authority : req.headers?.host;
  if (typeof host === "string") {
    return host;
  }

  return undefined;
}

function getProtocol(
  req: IncomingMessage | Http2ServerRequest
): "http" | "https" {
  const forwarded =
    req.headers?.["x-forwarded-proto"] || req.headers?.["x-forwarded-protocol"];
  if (typeof forwarded === "string" && trustProxy()) {
    const normalized = forwarded.toLowerCase();
    if (normalized === "https" || normalized === "http") {
      return normalized;
    }
  }

  if (req instanceof Http2ServerRequest && req.scheme === "https") {
    return "https";
  }

  if (req.socket && (req.socket as TLSSocket).encrypted) {
    return "https";
  }

  return "http";
}
