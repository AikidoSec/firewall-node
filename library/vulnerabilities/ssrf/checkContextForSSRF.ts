/* eslint-disable max-lines-per-function */
import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { SOURCES } from "../../agent/Source";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { trustProxy } from "../../helpers/trustProxy";
import { tryParseURL } from "../../helpers/tryParseURL";
import { containsPrivateIPAddress } from "./containsPrivateIPAddress";
import { findHostnameInUserInput } from "./findHostnameInUserInput";
import { getMetadataForSSRFAttack } from "./getMetadataForSSRFAttack";

/**
 * This function goes over all the different input types in the context and checks
 * if it possibly implies SSRF, if so the function returns an InterceptorResult
 */
export function checkContextForSSRF({
  hostname,
  port,
  operation,
  context,
}: {
  hostname: string;
  port: number | undefined;
  operation: string;
  context: Context;
}): InterceptorResult {
  // If the hostname is not a private IP address, we don't need to iterate over the user input
  // DNS lookup calls will be inspected somewhere else
  // This is just to inspect direct invocations of `http.request` and similar
  // Where the hostname might be a private IP address (or localhost)
  if (!containsPrivateIPAddress(hostname)) {
    return;
  }

  if (trustProxy() && context.url) {
    // We don't want to block outgoing requests to the same host as the server
    // (often happens that we have a match on headers like `Host`, `Origin`, `Referer`, etc.)
    // We have to check the port as well, because the hostname can be the same but with a different port
    // If Node.js is exposed to the internet, we can't be sure about the Host header
    const baseURL = tryParseURL(context.url);
    if (
      baseURL &&
      baseURL.hostname === hostname &&
      getPortFromURL(baseURL) === port
    ) {
      return;
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
          operation: operation,
          kind: "ssrf",
          source: source,
          pathsToPayload: paths,
          metadata: getMetadataForSSRFAttack({ hostname, port }),
          payload: str,
        };
      }
    }
  }
}
