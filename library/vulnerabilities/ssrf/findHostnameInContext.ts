import { Context } from "../../agent/Context";
import { Source } from "../../agent/Source";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { getSourceForUserString } from "../../helpers/getSourceForUserString";
import { findHostnameInUserInput } from "./findHostnameInUserInput";
import { isRequestToItself } from "./isRequestToItself";
import { isRequestToServiceHostname } from "./isRequestToServiceHostname";
import { getServerUrlFromContext } from "./getServerUrlFromContext";

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

  // Build full server URL from context for self-request detection.
  // Some frameworks set context.url to just the path (e.g. "/"), which
  // prevents isRequestToItself from comparing hostnames.
  // See https://github.com/AikidoSec/firewall-node/pull/796 for the
  // full fix that normalizes context.url across all frameworks.
  const serverUrl = getServerUrlFromContext(context);

  if (
    serverUrl &&
    isRequestToItself({
      serverUrl: serverUrl,
      outboundHostname: hostname,
      outboundPort: port,
    })
  ) {
    // We don't want to block outgoing requests to the same host as the server
    // (often happens that we have a match on headers like `Host`, `Origin`, `Referer`, etc.)
    return undefined;
  }

  for (const str of extractStringsFromUserInputCached(context)) {
    const found = findHostnameInUserInput(str, hostname, port);
    if (found) {
      const source = getSourceForUserString(context, str);
      if (source) {
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
