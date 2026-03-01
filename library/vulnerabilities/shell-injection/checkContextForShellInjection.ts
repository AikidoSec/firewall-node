import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { getSourceForUserString } from "../../helpers/getSourceForUserString";
import { isShellInjectionStrictMode } from "../../helpers/isShellInjectionStrictMode";
import { detectShellInjection } from "./detectShellInjection";
import { detectShellInjectionWasm } from "./detectShellInjectionWasm";

/**
 * This function goes over all the different input types in the context and checks
 * if it's a possible shell Injection, if so the function returns an InterceptorResult
 */
export function checkContextForShellInjection({
  command,
  operation,
  context,
}: {
  command: string;
  operation: string;
  context: Context;
}): InterceptorResult {
  const strictMode = isShellInjectionStrictMode();

  for (const str of extractStringsFromUserInputCached(context)) {
    const isInjection = strictMode
      ? detectShellInjectionWasm(command, str)
      : detectShellInjection(command, str);

    if (isInjection) {
      const source = getSourceForUserString(context, str);
      if (source) {
        return {
          operation: operation,
          kind: "shell_injection",
          source: source,
          pathsToPayload: getPathsToPayload(str, context[source]),
          metadata: {
            command: command,
          },
          payload: str,
        };
      }
    }
  }
}
