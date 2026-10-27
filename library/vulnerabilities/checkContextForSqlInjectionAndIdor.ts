import { getInstance } from "../agent/AgentSingleton";
import type { Context } from "../agent/Context";
import {
  isAttackResult,
  type InterceptorResult,
} from "../agent/hooks/InterceptorResult";
import {
  checkContextForIdor,
  type ResolvePlaceholder,
} from "./idor/checkContextForIdor";
import { checkContextForSqlInjection } from "./sql-injection/checkContextForSqlInjection";
import { createSafeObject } from "../helpers/createSafeObject";
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

  const idorResult = checkContextForIdor({ sql, dialect, resolvePlaceholder });
  if (!idorResult) {
    return sqlInjectionResult;
  }

  // Also report detected attack to core
  return isAttackResult(sqlInjectionResult)
    ? createSafeObject(idorResult, { attack: sqlInjectionResult })
    : idorResult;
}
