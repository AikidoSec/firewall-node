import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/MethodInterceptor";
import { SOURCES } from "../../agent/Source";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";
import { containsPrivateIPAddress } from "./containsPrivateIPAddress";
import { findHostnameInUserInput } from "./findHostnameInUserInput";

/**
 * This function goes over all the different input types in the context and checks
 * if it possibly implies SSRF, if so the function returns an InterceptorResult
 */
export function checkContextForSSRF({
  hostname,
  operation,
  context,
}: {
  hostname: string;
  operation: string;
  context: Context;
}): InterceptorResult {
  for (const source of SOURCES) {
    if (context[source]) {
      const userInput = extractStringsFromUserInput(context[source]);
      for (const [str, path] of userInput.entries()) {
        const found = findHostnameInUserInput(str, hostname);
        if (found && containsPrivateIPAddress(hostname)) {
          return {
            operation: operation,
            kind: "ssrf",
            source: source,
            pathToPayload: path,
            metadata: {},
            payload: str,
          };
        }
      }
    }
  }
}
