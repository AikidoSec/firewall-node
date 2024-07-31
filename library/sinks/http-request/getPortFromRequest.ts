import type { RequestOptions as HTTPSRequestOptions } from "https";
import type { RequestOptions as HTTPRequestOptions } from "http";
import { getPortFromURL } from "../../helpers/getPortFromURL";

/**
 * Gets the port from the request options or URL of an HTTP request.
 */
export function getPortFromHTTPRequestArgs(
  args: unknown[],
  module?: "http" | "https"
): number | undefined {
  if (!args || !args.length) {
    return undefined;
  }
  const requestOptions = getRequestOptions(args);
  if (requestOptions) {
    // If port option is provided, its precedence is higher than in the URL
    const port = getPortFromRequestOptions(requestOptions);
    if (port) {
      return port;
    }
  }

  // Url provided as a string
  if (typeof args[0] === "string" && args[0].length > 0) {
    try {
      const url = new URL(args[0]);
      if (url.hostname.length > 0) {
        return getPortFromURL(url);
      }
    } catch (e) {
      // Ignore
    }
  }

  // Url provided as a URL object
  if (args[0] instanceof URL && args[0].hostname.length > 0) {
    return getPortFromURL(args[0]);
  }

  // Fall back to default ports
  if (module === "http") {
    return 80;
  }
  if (module === "https") {
    return 443;
  }

  return undefined;
}

/**
 * Request options can be provided as the first argument or as the second argument.
 * But thy can also be not provided at all.
 */
function getRequestOptions(args: unknown[]) {
  if (typeof args[0] === "object" && !(args[0] instanceof URL)) {
    return args[0] as HTTPRequestOptions | HTTPSRequestOptions;
  } else if (
    args.length > 1 &&
    typeof args[1] === "object" &&
    !(args[1] instanceof URL)
  ) {
    return args[1] as HTTPRequestOptions | HTTPSRequestOptions;
  }
  return undefined;
}

function getPortFromRequestOptions(
  options: HTTPRequestOptions | HTTPSRequestOptions
) {
  if (typeof options.port === "number") {
    return options.port;
  }
  if (typeof options.port === "string") {
    const port = parseInt(options.port, 10);
    if (Number.isInteger(port)) {
      return port;
    }
  }
  if (typeof options.defaultPort === "number") {
    return options.defaultPort;
  }
  if (typeof options.defaultPort === "string") {
    const port = parseInt(options.defaultPort, 10);
    if (Number.isInteger(port)) {
      return port;
    }
  }
  return undefined;
}
