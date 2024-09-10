import { getPortFromURL } from "../../helpers/getPortFromURL";
import { tryParseURL } from "../../helpers/tryParseURL";
import { isOptionsObject } from "../http-request/isOptionsObject";

/**
 * Determines the hostname and port from the arguments of an http2.connect call.
 * We are parsing the arguments to URL objects to support domains with special characters.
 */
export function getHostFromHTTP2RequestArgs(
  args: unknown[]
): { hostname: string; port: number | undefined } | undefined {
  if (!args || !args.length) {
    return undefined;
  }

  const authority = parseAuthority(args[0]);
  if (authority) {
    if (args.length > 1 && isOptionsObject(args[1])) {
      const merged = mergeAuthorityWithOptions(authority, args[1]);
      if (merged) {
        return merged;
      }
    }
    return {
      hostname: authority.hostname,
      port: getPortFromURL(authority),
    };
  }

  return undefined;
}

/**
 * Parse the authority (first argument) of the http2.connect call.
 */
function parseAuthority(authority: unknown): URL | undefined {
  if (typeof authority === "string") {
    return tryParseURL(authority);
  }
  if (authority instanceof URL) {
    return authority;
  }
  if (isOptionsObject(authority)) {
    return getUrlFromObject(authority);
  }
}

/**
 * Build a URL object from a url like object.
 * Ignores the path as its not relevant for getting the hostname and port.
 * The http2.connect method ignores the path as well.
 */
function getUrlFromObject(options: any): URL | undefined {
  let str = "";
  if (typeof options.protocol === "string") {
    str += options.protocol;
  } else {
    // https is the default protocol for node:http2
    str += `https:`;
  }
  str += "//";

  if (typeof options.hostname === "string") {
    str += options.hostname;
  } else if (typeof options.host === "string") {
    str += options.host;
  }

  if (options.port) {
    if (typeof options.port === "number" && options.port > 0) {
      str += `:${options.port}`;
    }
    if (typeof options.port === "string" && options.port.length > 0) {
      str += `:${options.port}`;
    }
  }

  return tryParseURL(str);
}

/**
 * Merge the authority with the options object if both are provided to the http2.connect call.
 */
function mergeAuthorityWithOptions(
  authority: URL,
  options: Record<string, any>
): { hostname: string; port: number | undefined } | undefined {
  let hostname = authority.hostname;
  let port = getPortFromURL(authority);

  // options.port overrides the authority port
  if (typeof options.port === "number" && options.port > 0) {
    port = options.port;
  } else if (typeof options.port === "string" && options.port.length > 0) {
    const p = parseInt(options.port, 10);
    if (!isNaN(p) && p > 0) {
      port = p;
    }
  }

  return { hostname, port };
}
