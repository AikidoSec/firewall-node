import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/MethodInterceptor";
import { Source } from "../../agent/Source";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";
import { detectShellInjection } from "./detectShellInjection";

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
  for (const source of [
    "body",
    "query",
    "headers",
    "cookies",
    "routeParams",
  ] as Source[]) {
    if (context[source]) {
      const userInput = extractStringsFromUserInput(context[source]);
      for (const [str, path] of userInput.entries()) {
        if (detectShellInjection(command, str)) {
          return {
            operation: operation,
            kind: "shell_injection",
            source: source,
            pathToPayload: path,
            metadata: {
              command: command,
            },
            payload: str,
          };
        }
      }
    }
  }
}
