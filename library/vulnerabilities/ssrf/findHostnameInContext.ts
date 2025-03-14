import { Context } from "../../agent/Context";
import { Source, SOURCES } from "../../agent/Source";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { trustProxy } from "../../helpers/trustProxy";
import { tryParseURL } from "../../helpers/tryParseURL";
import { findHostnameInUserInput } from "./findHostnameInUserInput";

type HostnameLocation = {
  source: Source;
  pathsToPayload: string[];
  payload: string;
  port: number | undefined;
  hostname: string;
};

export function findHostnameInContext(
  hostname: string,
  context: Context,
  port: number | undefined
): HostnameLocation | undefined {
  if (trustProxy() && context.url) {
    // We don't want to block outgoing requests to the same host as the server
    // (often happens that we have a match on headers like `Host`, `Origin`, `Referer`, etc.)
    // We have to check the port as well, because the hostname can be the same but with a different port
    // If Node.js is exposed to the internet, we can't be sure about the Host header
    const baseURL = tryParseURL(context.url);
    if (baseURL && baseURL.hostname === hostname) {
      const baseURLPort = getPortFromURL(baseURL);
      if (baseURLPort === port) {
        return undefined;
      }
      // Special case for HTTP/HTTPS ports
      // In production, the app will be served on port 80 and 443
      if (baseURLPort === 80 && port === 443) {
        return undefined;
      }
      if (baseURLPort === 443 && port === 80) {
        return undefined;
      }
    }
  }

  for (const source of SOURCES) {
    const userInput = extractStringsFromUserInputCached(context, source);
    if (!userInput) {
      continue;
    }

    for (const str of userInput) {
      const found = findHostnameInUserInput(str, hostname, port);
      if (found) {
        const paths = getPathsToPayload(str, context[source]);

        return {
          source: source,
          pathsToPayload: paths,
          payload: str,
          port: port,
          hostname: hostname,
        };
      }
    }
  }

  return undefined;
}
