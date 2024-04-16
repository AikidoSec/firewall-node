import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/MethodInterceptor";
import { Source } from "../../agent/Source";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";
import { findHostnameInUserInput, isPrivateIP } from "./detectSSRF";

/**
 * This function goes over all the different input types in the context and checks
 * if it possibly implies SSRF, if so the function returns an InterceptorResult
 */
export function checkContextForSSRF({
  hostname,
  ipAddress,
  operation,
  context,
}: {
  hostname: string;
  ipAddress: string;
  operation: string;
  context: Context;
}): InterceptorResult {
  for (const source of ["body", "query", "headers", "cookies"] as Source[]) {
    if (context[source]) {
      const userInput = extractStringsFromUserInput(context[source]);
      for (const [str, path] of userInput.entries()) {
        const found = findHostnameInUserInput(str, hostname);
        if (found && isPrivateIP(ipAddress)) {
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
