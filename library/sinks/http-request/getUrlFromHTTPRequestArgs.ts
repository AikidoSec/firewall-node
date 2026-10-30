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
export function getRequestOptions(args: unknown[]) {
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
  if (typeof options.protocol === "string" && options.protocol.length > 0) {
    str += options.protocol;
  } else if (module) {
    str += `${module}:`;
  }

  str += "//";
  if (typeof options.hostname === "string" && options.hostname.length > 0) {
    str += wrapWithSquareBracketsIfNeeded(options.hostname);
  } else if (typeof options.host === "string" && options.host.length > 0) {
    str += wrapWithSquareBracketsIfNeeded(options.host);
  } else {
    // Node.js default value, see https://github.com/nodejs/node/blob/a3bb551ea70c7e0b1377c5b97d5d186cd66095cd/lib/_http_client.js#L406-L407
    str += "localhost";
  }

  // Node.js uses `options.port || options.defaultPort || agent.defaultPort`
  const port =
    getValidPort(options.port) ??
    getValidPort(options.defaultPort) ??
    getAgentDefaultPort(options);
  if (port !== undefined) {
    str += `:${port}`;
  }

  if (typeof options.path === "string") {
    str += normalizePath(options.path);
  }

  return tryParseURL(str);
}

function getValidPort(port: unknown): string | number | undefined {
  if (typeof port === "number" && port > 0) {
    return port;
  }
  if (typeof port === "string" && port.length > 0) {
    return port;
  }
  return undefined;
}

function getAgentDefaultPort(
  options: HTTPRequestOptions | HTTPSRequestOptions
): string | number | undefined {
  const agent = options.agent;
  if (typeof agent === "object" && agent !== null && "defaultPort" in agent) {
    return getValidPort(agent.defaultPort);
  }
  return undefined;
}

// A path like "@evil.com/" appended to the host would turn the host into userinfo.
// Prefixing a slash keeps the path out of the authority.
function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
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

  const port =
    getValidPort(options.port) ??
    (url.port ||
      getValidPort(options.defaultPort) ||
      getAgentDefaultPort(options));
  if (port !== undefined && port !== "") {
    urlStr += `:${port}`;
  }

  if (options.path) {
    // Include the query string and hash
    urlStr += normalizePath(options.path);
  } else {
    urlStr += url.pathname + url.search;
  }

  return tryParseURL(urlStr);
}
