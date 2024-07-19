import type { RequestOptions as HTTPSRequestOptions } from "https";
import type { RequestOptions as HTTPRequestOptions } from "http";
import { getPortFromURL } from "../../helpers/getPortFromURL";

/**
 * Gets the port from the request options or URL of an HTTP request.
 */
export function getPortFromHTTPRequestOptions(
  args: unknown[],
  module?: "http" | "https"
): number | undefined {
  if (!args || !args.length) {
    return undefined;
  }

  let requestOptions: HTTPRequestOptions | HTTPSRequestOptions | undefined;

  // Request options can be in the first or second position
  if (typeof args[0] === "object" && !(args[0] instanceof URL)) {
    requestOptions = args[0] as HTTPRequestOptions | HTTPSRequestOptions;
  } else if (
    args.length > 1 &&
    typeof args[1] === "object" &&
    !(args[1] instanceof URL)
  ) {
    requestOptions = args[1] as HTTPRequestOptions | HTTPSRequestOptions;
  }

  if (requestOptions) {
    // If port option is provided, its precedence is higher
    if (typeof requestOptions.port === "number") {
      return requestOptions.port;
    }
    if (typeof requestOptions.port === "string") {
      const port = parseInt(requestOptions.port, 10);
      if (Number.isInteger(port)) {
        return port;
      }
    }
    if (typeof requestOptions.defaultPort === "number") {
      return requestOptions.defaultPort;
    }
    if (typeof requestOptions.defaultPort === "string") {
      const port = parseInt(requestOptions.defaultPort, 10);
      if (Number.isInteger(port)) {
        return port;
      }
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
