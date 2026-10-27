import { getInstance } from "../agent/AgentSingleton";
import type { Context } from "../agent/Context";
import type { InterceptorResult } from "../agent/hooks/InterceptorResult";
import {
  checkContextForIdor,
  type ResolvePlaceholder,
} from "./idor/checkContextForIdor";
import { checkContextForSqlInjection } from "./sql-injection/checkContextForSqlInjection";
import type { SQLDialect } from "./sql-injection/dialects/SQLDialect";

export function checkContextForSqlInjectionAndIdor({
  sql,
  operation,
  context,
  dialect,
  resolvePlaceholder,
}: {
  sql: string;
  operation: string;
  context: Context | undefined;
  dialect: SQLDialect;
  resolvePlaceholder: ResolvePlaceholder;
}): InterceptorResult {
  const sqlInjectionResult = context
    ? checkContextForSqlInjection({ sql, context, operation, dialect })
    : undefined;

  if (sqlInjectionResult && getInstance()?.shouldBlock()) {
    return sqlInjectionResult;
  }

  return (
    checkContextForIdor({ sql, dialect, resolvePlaceholder }) ??
    sqlInjectionResult
  );
}
