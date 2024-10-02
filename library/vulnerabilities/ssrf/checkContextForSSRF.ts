import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/MethodInterceptor";
import { SOURCES } from "../../agent/Source";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { containsPrivateIPAddress } from "./containsPrivateIPAddress";
import { findHostnameInUserInput } from "./findHostnameInUserInput";
import { getMetadataForSSRFAttack } from "./getMetadataForSSRFAttack";
import { isRequestToItself } from "./isRequestToItself";

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
  for (const source of SOURCES) {
    const userInput = extractStringsFromUserInputCached(context, source);
    if (!userInput) {
      continue;
    }

    for (const [str, path] of userInput.entries()) {
      const found = findHostnameInUserInput(str, hostname, port);
      if (found && containsPrivateIPAddress(hostname)) {
        if (
          isRequestToItself({
            str: str,
            source: source,
            port: port,
            path: path,
          })
        ) {
          // Application might do a request to itself when the hostname is localhost
          // Let's allow this (only for the headers.host source)
          // We still want to block if the port is different
          continue;
        }

        return {
          operation: operation,
          kind: "ssrf",
          source: source,
          pathToPayload: path,
          metadata: getMetadataForSSRFAttack({ hostname, port }),
          payload: str,
        };
      }
    }
  }
}
