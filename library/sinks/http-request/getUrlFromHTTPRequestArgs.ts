import type { RequestOptions as HTTPSRequestOptions } from "https";
import type { RequestOptions as HTTPRequestOptions } from "http";
import { isIPv6 } from "net";
import { tryParseURL } from "../../helpers/tryParseURL";
import { isOptionsObject } from "./isOptionsObject";

/**
 * Gets the url from the arguments of a node:http(s) outgoing request function call.
 */
export function getUrlFromHTTPRequestArgs(
  args: unknown[],
  module: "http" | "https"
): URL | undefined {
  if (!args || !args.length) {
    return undefined;
  }

  let url: URL | undefined;

  // Url provided as a string
  if (typeof args[0] === "string" && args[0].length > 0) {
    url = tryParseURL(args[0]);
  }

  // Url provided as a URL object
  if (args[0] instanceof URL) {
    url = args[0];
  }

  const requestOptions = getRequestOptions(args);
  if (requestOptions) {
    if (!url) {
      return getUrlFromRequestOptions(requestOptions, module);
    }

    return mergeURLWithRequestOptions(requestOptions, url);
  }

  return url;
}

/**
 * Request options can be provided as the first argument or as the second argument.
 * But thy can also be not provided at all.
 */
function getRequestOptions(args: unknown[]) {
  if (isOptionsObject(args[0]) && !(args[0] instanceof URL)) {
    return args[0] as HTTPRequestOptions | HTTPSRequestOptions;
  } else if (
    args.length > 1 &&
    isOptionsObject(args[1]) &&
    !(args[1] instanceof URL)
  ) {
    return args[1] as HTTPRequestOptions | HTTPSRequestOptions;
  }
  return undefined;
}

/**
 * Build a URL object from the outgoing http(s) request options.
 */
function getUrlFromRequestOptions(
  options: HTTPRequestOptions | HTTPSRequestOptions,
  module: "http" | "https"
): URL | undefined {
  let str = "";
  if (typeof options.protocol === "string") {
    str += options.protocol;
  } else if (module) {
    str += `${module}:`;
  }

  str += "//";
  if (typeof options.hostname === "string") {
    str += wrapWithSquareBracketsIfNeeded(options.hostname);
  } else if (typeof options.host === "string") {
    str += wrapWithSquareBracketsIfNeeded(options.host);
  }

  if (options.port) {
    if (typeof options.port === "number" && options.port > 0) {
      str += `:${options.port}`;
    }
    if (typeof options.port === "string" && options.port.length > 0) {
      str += `:${options.port}`;
    }
  }

  if (typeof options.path === "string") {
    str += options.path;
  }

  return tryParseURL(str);
}

// Many HTTP clients pass the separate URL parts as properties of the options object, example:
// http.request({ protocol: 'http:', hostname: 'example.com', port: 80, path: '/path' })
//
// When you have an IPv6 address as the hostname, a client might pass it without square brackets:
// http.request({ hostname: '::', ... })
//
// When we reconstruct a URL from these options, we need to wrap the hostname in square brackets if it's an IPv6 address
// Otherwise the URL will be invalid
// http://:::80/path
// should be
// http://[::]:80/path
function wrapWithSquareBracketsIfNeeded(hostname: string): string {
  if (isIPv6(hostname)) {
    return `[${hostname}]`;
  }

  return hostname;
}

/**
 * Merge the url created from the request options with the url provided as a string or URL object.
 * Node.js docs: If both url and options are specified, the objects are merged, with the options properties taking precedence.
 */
function mergeURLWithRequestOptions(
  options: HTTPRequestOptions | HTTPSRequestOptions,
  url: URL
): URL | undefined {
  let urlStr = "";

  if (options.protocol) {
    urlStr += options.protocol;
  } else {
    urlStr += url.protocol;
  }

  urlStr += "//";

  if (options.hostname) {
    urlStr += wrapWithSquareBracketsIfNeeded(options.hostname);
  } else if (options.host) {
    urlStr += wrapWithSquareBracketsIfNeeded(options.host);
  } else {
    urlStr += wrapWithSquareBracketsIfNeeded(url.hostname);
  }

  if (options.port) {
    urlStr += `:${options.port}`;
  } else if (url.port) {
    urlStr += `:${url.port}`;
  }

  if (options.path) {
    // Include the query string and hash
    urlStr += options.path;
  } else {
    urlStr += url.pathname + url.search;
  }

  return tryParseURL(urlStr);
}
