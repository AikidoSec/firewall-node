import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { getPathsToPayload } from "../../helpers/attackPath";
import { envToBool } from "../../helpers/envToBool";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { getSourceForUserString } from "../../helpers/getSourceForUserString";
import {
  detectSQLInjection,
  SQLInjectionDetectionResult,
} from "./detectSQLInjection";
import { SQLDialect } from "./dialects/SQLDialect";

/**
 * Block SQL queries that fail tokenization by default.
 * Set AIKIDO_BLOCK_INVALID_SQL=false to disable.
 */
function shouldBlockInvalidSqlQueries(): boolean {
  if (process.env.AIKIDO_BLOCK_INVALID_SQL === undefined) {
    return true;
  }

  return envToBool(process.env.AIKIDO_BLOCK_INVALID_SQL);
}

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
  for (const str of extractStringsFromUserInputCached(context)) {
    const result = detectSQLInjection(sql, str, dialect);

    if (result === SQLInjectionDetectionResult.INJECTION_DETECTED) {
      const source = getSourceForUserString(context, str);
      if (source) {
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
    }

    if (result === SQLInjectionDetectionResult.FAILED_TO_TOKENIZE) {
      // If our tokenizer can't handle the query, we can't detect SQL injection.
      // Attackers can exploit this (e.g. ClickHouse ignores invalid SQL after `;`,
      // SQLite allows `/*` without closing `*/`).
      if (shouldBlockInvalidSqlQueries()) {
        const source = getSourceForUserString(context, str);
        if (source) {
          return {
            operation: operation,
            kind: "sql_injection",
            source: source,
            pathsToPayload: getPathsToPayload(str, context[source]),
            metadata: {
              sql: sql,
              dialect: dialect.getHumanReadableName(),
              failedToTokenize: "true",
            },
            payload: str,
          };
        }
      }
    }
  }
}
