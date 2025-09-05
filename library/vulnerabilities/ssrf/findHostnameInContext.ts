import { Context } from "../../agent/Context";
import { Source, SOURCES } from "../../agent/Source";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { findHostnameInUserInput } from "./findHostnameInUserInput";
import { isRequestToItself } from "./isRequestToItself";
import { isRequestToServiceHostname } from "./isRequestToServiceHostname";

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
  if (isRequestToServiceHostname(hostname)) {
    // We don't want to block outgoing requests to service hostnames
    // e.g. "discord-bot" or "my_service" or "BACKEND"
    // These might occur ^ easily in the user input
    return undefined;
  }

  if (
    context.url &&
    isRequestToItself({
      serverUrl: context.url,
      outboundHostname: hostname,
      outboundPort: port,
    })
  ) {
    // We don't want to block outgoing requests to the same host as the server
    // (often happens that we have a match on headers like `Host`, `Origin`, `Referer`, etc.)
    return undefined;
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
