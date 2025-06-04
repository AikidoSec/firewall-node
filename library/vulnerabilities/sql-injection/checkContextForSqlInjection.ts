/* eslint-disable max-lines-per-function */
import { getInstance } from "../../agent/AgentSingleton";
import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { SOURCES } from "../../agent/Source";
import { getPathsToPayload } from "../../helpers/attackPath";
import { cleanupStackTrace } from "../../helpers/cleanupStackTrace";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { getLibraryRoot } from "../../helpers/getLibraryRoot";
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

      if (result === SQLInjectionDetectionResult.INJECTION_DETECTED) {
        return {
          operation: operation,
          kind: "sql_injection",
          source: source,
          pathsToPayload: getPathsToPayload(str, context[source]),
          metadata: {
            sql: sql,
            dialect: dialect.getHumanReadableName(),
          },
          payload: str,
        };
      }

      if (result === SQLInjectionDetectionResult.FAILED_TO_TOKENIZE) {
        // We don't want to block queries that fail to tokenize.
        // This counter helps us monitor how often our SQL tokenizer fails.
        getInstance()?.getInspectionStatistics().onSqlTokenizationFailure();
      }
    }
  }
}
