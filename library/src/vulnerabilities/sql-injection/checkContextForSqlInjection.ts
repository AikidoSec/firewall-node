import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/MethodInterceptor";
import { Source } from "../../agent/Source";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";
import { detectSQLInjection } from "./detectSQLInjection";

/**
 * This function goes over all the different input types in the context and checks
 * if it's a possible SQL Injection, if so the function returns an InterceptorResult
 */
export function checkContextForSqlInjection({
  sql,
  operation,
  context,
}: {
  sql: string;
  operation: string;
  context: Context;
}): InterceptorResult {
  for (const source of ["body", "query", "headers", "cookies"] as Source[]) {
    if (context[source]) {
      const userInput = extractStringsFromUserInput(context[source]);
      for (const str of userInput) {
        if (detectSQLInjection(sql, str)) {
          return {
            operation: operation,
            kind: "sql_injection",
            source: source,
            pathToPayload: "UNKOWN",
            metadata: {},
          };
        }
      }
    }
  }
}
