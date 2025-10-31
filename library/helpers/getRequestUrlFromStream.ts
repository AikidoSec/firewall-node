import type { IncomingHttpHeaders } from "http2";
import { trustProxy } from "./trustProxy";

/**
 * Get the full request URL including protocol and host for HTTP/2 streams.
 * Falls back to relative URL if host is not available.
 * Also respects forwarded headers if proxies are trusted.
 */
export function getRequestUrlFromStream(
  headers: IncomingHttpHeaders | undefined
): string | undefined {
  const path = headers?.[":path"] || "";

  const host = getHost(headers);
  if (!host) {
    // Fallback to relative URL if host is not available
    return path || undefined;
  }

  // Determine protocol, fallback to http if not detectable
  const protocol = getProtocol(headers);

  return `${protocol}://${host}${path}`;
}

function getHost(headers: IncomingHttpHeaders | undefined): string | undefined {
  const forwardedHost = headers?.["x-forwarded-host"];

  if (typeof forwardedHost === "string" && trustProxy()) {
    return forwardedHost;
  }

  const host = headers?.[":authority"];
  if (typeof host === "string") {
    return host;
  }

  return undefined;
}

function getProtocol(
  headers: IncomingHttpHeaders | undefined
): "http" | "https" {
  const forwarded =
    headers?.["x-forwarded-proto"] || headers?.["x-forwarded-protocol"];
  if (typeof forwarded === "string" && trustProxy()) {
    const normalized = forwarded.toLowerCase();
    if (normalized === "https" || normalized === "http") {
      return normalized;
    }
  }

  if (headers?.[":scheme"] === "https") {
    return "https";
  }

  return "http";
}
