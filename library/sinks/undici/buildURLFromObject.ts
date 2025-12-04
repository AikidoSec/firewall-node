import { tryParseURL } from "../../helpers/tryParseURL";
import { isOptionsObject } from "../http-request/isOptionsObject";

export function buildURLFromArgs(args: unknown[]) {
  if (args.length === 0) {
    return undefined;
  }

  if (typeof args[0] === "string") {
    return tryParseURL(args[0]);
  }

  // undici also exports `fetch` (like the global fetch)
  // Fetch accepts any object with a stringifier. User input may be an array if the user provides an array
  // query parameter (e.g., ?example[0]=https://example.com/) in frameworks like Express. Since an Array has
  // a default stringifier, this is exploitable in a default setup.
  // The following condition ensures that we see the same value as what's passed down to the sink.
  if (Array.isArray(args[0])) {
    return tryParseURL(args[0].toString());
  }

  if (args[0] instanceof URL) {
    return args[0];
  }

  if (isOptionsObject(args[0])) {
    return buildURLFromObject(args[0] as Record<string, unknown>);
  }

  return undefined;
}

// Logic copied from parseURL in https://github.com/nodejs/undici/blob/main/lib/core/util.js
// Note: { hostname: string, port: number } is not accepted by Undici
function buildURLFromObject(url: Record<string, unknown>) {
  const port = url.port ? url.port : url.protocol === "https:" ? 443 : 80;

  let origin = url.origin
    ? url.origin
    : `${url.protocol || ""}//${url.hostname || ""}:${port}`;
  if (typeof origin === "string" && origin[origin.length - 1] === "/") {
    origin = origin.slice(0, origin.length - 1);
  }

  let path = url.path ? url.path : `${url.pathname || ""}${url.search || ""}`;
  if (typeof path === "string" && path[0] !== "/") {
    path = `/${path}`;
  }

  return tryParseURL(`${origin}${path}`);
}
