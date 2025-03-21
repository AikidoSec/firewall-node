import { getPortFromURL } from "../../helpers/getPortFromURL";
import { trustProxy } from "../../helpers/trustProxy";
import { tryParseURL } from "../../helpers/tryParseURL";

// We don't want to block outgoing requests to the same host as the server
// (often happens that we have a match on headers like `Host`, `Origin`, `Referer`, etc.)
// We have to check the port as well, because the hostname can be the same but with a different port
export function isRequestToItself({
  serverUrl,
  outboundHostname,
  outboundPort,
}: {
  serverUrl: string;
  outboundHostname: string;
  outboundPort: number | undefined;
}): boolean {
  // When Node.js is not behind a reverse proxy, we can't trust the hostname inside `serverUrl`
  // The hostname in `serverUrl` is built from the request headers
  // The headers can be manipulated by the client if Node.js is directly exposed to the internet
  if (!trustProxy()) {
    return false;
  }

  const baseURL = tryParseURL(serverUrl);

  if (!baseURL) {
    return false;
  }

  if (baseURL.hostname !== outboundHostname) {
    return false;
  }

  const baseURLPort = getPortFromURL(baseURL);

  // If the port is the same, the server is making a request to itself
  if (baseURLPort === outboundPort) {
    return true;
  }

  // Special case for HTTP/HTTPS ports
  // In production, the app will be served on port 80 and 443
  if (baseURLPort === 80 && outboundPort === 443) {
    return true;
  }
  if (baseURLPort === 443 && outboundPort === 80) {
    return true;
  }

  return false;
}
