import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { SOURCES } from "../../agent/Source";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { detectJsInjection } from "./detectJsInjection";

/**
 * This function goes over all the different input types in the context and checks
 * if it's a possible JS Injection, if so the function returns an InterceptorResult
 */
export function checkContextForJsInjection({
  js,
  operation,
  context,
}: {
  js: string;
  operation: string;
  context: Context;
}): InterceptorResult {
  for (const source of SOURCES) {
    const userInput = extractStringsFromUserInputCached(context, source);
    if (!userInput) {
      continue;
    }

    for (const [str, path] of userInput.entries()) {
      if (detectJsInjection(js, str)) {
        return {
          operation: operation,
          kind: "js_injection",
          source: source,
          pathToPayload: path,
          metadata: {
            js: js,
          },
          payload: str,
        };
      }
    }
  }
}
