import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { SOURCES } from "../../agent/Source";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import {
  detectSQLInjection,
  SQLInjectionDetectionResult,
} from "./detectSQLInjection";
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

    for (const str of userInput) {
      const result = detectSQLInjection(sql, str, dialect);

      if (
        result === SQLInjectionDetectionResult.INJECTION_DETECTED ||
        result === SQLInjectionDetectionResult.FAILED_TO_TOKENIZE
      ) {
        const metadata: Record<string, string> = {
          sql: sql,
          dialect: dialect.getHumanReadableName(),
        };

        if (result === SQLInjectionDetectionResult.FAILED_TO_TOKENIZE) {
          // eslint-disable-next-line camelcase
          metadata.failed_to_tokenize = "true";
        }

        return {
          operation: operation,
          kind: "sql_injection",
          source: source,
          pathsToPayload: getPathsToPayload(str, context[source]),
          metadata: metadata,
          payload: str,
        };
      }
    }
  }
}
