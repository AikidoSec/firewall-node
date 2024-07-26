import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/MethodInterceptor";
import { SOURCES } from "../../agent/Source";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialect } from "./dialects/SQLDialect";

/**
 * This function goes over all the different input types in the context and checks
 * if it's a possible SQL Injection, if so the function returns an InterceptorResult
 */
export function checkContextForSqlInjection({
  sql,
  operation,
  context,
  dialect,
}: {
  sql: string;
  operation: string;
  context: Context;
  dialect: SQLDialect;
}): InterceptorResult {
  for (const source of SOURCES) {
    const userInput = extractStringsFromUserInputCached(context, source);
    if (!userInput) {
      continue;
    }

    for (const [str, path] of userInput.entries()) {
      if (detectSQLInjection(sql, str, dialect)) {
        return {
          operation: operation,
          kind: "sql_injection",
          source: source,
          pathToPayload: path,
          metadata: {},
          payload: str,
        };
      }
    }
  }
}
