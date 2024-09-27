import { getPortFromURL } from "../../helpers/getPortFromURL";
import { tryParseURL } from "../../helpers/tryParseURL";
import { isOptionsObject } from "../http-request/isOptionsObject";

type HostnameAndPort = {
  hostname: string;
  port: number | undefined;
};

/**
 * Extract hostname and port from the arguments of a undici request.
 * Used for SSRF detection.
 */
export function getHostInfoFromArgs(
  args: unknown[]
): HostnameAndPort | undefined {
  let url: URL | undefined;
  if (args.length > 0) {
    // URL provided as a string
    if (typeof args[0] === "string" && args[0].length > 0) {
      url = tryParseURL(args[0]);
    }
    // Fetch accepts any object with a stringifier. User input may be an array if the user provides an array
    // query parameter (e.g., ?example[0]=https://example.com/) in frameworks like Express. Since an Array has
    // a default stringifier, this is exploitable in a default setup.
    // The following condition ensures that we see the same value as what's passed down to the sink.
    if (Array.isArray(args[0])) {
      url = tryParseURL(args[0].toString());
    }

    // URL provided as a URL object
    if (args[0] instanceof URL) {
      url = args[0];
    }

    // If url is not undefined, extract the hostname and port
    if (url && url.hostname.length > 0) {
      return {
        hostname: url.hostname,
        port: getPortFromURL(url),
      };
    }

    // Check if it can be a request options object
    if (isOptionsObject(args[0])) {
      return parseOptionsObject(args[0]);
    }
  }

  return undefined;
}

/**
 * Parse a undici request options object to extract hostname and port.
 */
function parseOptionsObject(obj: any): HostnameAndPort | undefined {
  // Origin is preferred over hostname
  // See https://github.com/nodejs/undici/blob/c926a43ac5952b8b5a6c7d15529b56599bc1b762/lib/core/util.js#L177
  if (obj.origin != null && typeof obj.origin === "string") {
    const url = tryParseURL(obj.origin);
    if (url) {
      return {
        hostname: url.hostname,
        port: getPortFromURL(url),
      };
    }

    // Undici should throw an error if the origin is not a valid URL
    return undefined;
  }

  let port = 80;
  if (typeof obj.protocol === "string") {
    port = obj.protocol === "https:" ? 443 : 80;
  }
  if (typeof obj.port === "number") {
    port = obj.port;
  } else if (
    typeof obj.port === "string" &&
    Number.isInteger(parseInt(obj.port, 10))
  ) {
    port = parseInt(obj.port, 10);
  }

  // hostname is required by undici and host is not supported
  if (typeof obj.hostname !== "string" || obj.hostname.length === 0) {
    return undefined;
  }

  return {
    hostname: obj.hostname,
    port,
  };
}
