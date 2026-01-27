import { Context } from "../../agent/Context";
import { tryParseURL } from "../../helpers/tryParseURL";

/**
 * Some frameworks (e.g. Express) set context.url to an absolute URL,
 * while others (e.g. http.createServer used by Next.js) set it to just
 * the path (e.g. "/"). When context.url is not a full URL, we build one
 * from the Host header so that isRequestToItself can compare hostnames.
 *
 * We intentionally use the Host header (not x-forwarded-host) because we
 * need the actual internal server address for self-request detection.
 * The x-forwarded-host typically contains a public hostname which would
 * never match a private IP outbound request.
 */
export function getServerUrlFromContext(context: Context): string | undefined {
  if (!context.url) {
    return undefined;
  }

  // Already a full URL (e.g. from Express, Koa, Hono, etc.)
  if (tryParseURL(context.url)) {
    return context.url;
  }

  // Build full URL from Host header (e.g. for http.createServer / Next.js)
  const host = context.headers.host;
  if (typeof host === "string" && host.length > 0) {
    return `http://${host}${context.url}`;
  }

  return undefined;
}
