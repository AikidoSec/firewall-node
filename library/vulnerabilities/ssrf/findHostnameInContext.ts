import { Context } from "../../agent/Context";
import { Source, SOURCES } from "../../agent/Source";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { findHostnameInUserInput } from "./findHostnameInUserInput";
import { isRequestToItself } from "./isRequestToItself";

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
  for (const source of SOURCES) {
    const userInput = extractStringsFromUserInputCached(context, source);
    if (!userInput) {
      continue;
    }

    for (const str of userInput) {
      const found = findHostnameInUserInput(str, hostname, port);
      if (found) {
        const paths = getPathsToPayload(str, context[source]);

        if (
          isRequestToItself({
            str: str,
            source: source,
            port: port,
            paths: paths,
          })
        ) {
          // Application might do a request to itself when the hostname is localhost
          // Let's allow this for the following headers: Host, Origin, Referer
          // We still want to block if the port is different
          continue;
        }

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
