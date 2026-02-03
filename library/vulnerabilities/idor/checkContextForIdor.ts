import { getInstance } from "../../agent/AgentSingleton";
import { Context } from "../../agent/Context";
import { isIdorProtectionIgnored } from "../../agent/context/withoutIdorProtection";
import { IdorViolationResult } from "../../agent/hooks/InterceptorResult";
import { LRUMap } from "../../ratelimiting/LRUMap";
import { wasm_idor_analyze_sql } from "../../internals/zen_internals";
import { SQLDialect } from "../sql-injection/dialects/SQLDialect";
import type { SqlQueryResult } from "./IdorAnalysisResult";
import { IdorProtectionConfig } from "../../agent/IdorProtectionConfig";

export function checkContextForIdor({
  sql,
  context,
  dialect,
  resolvePlaceholder,
}: {
  sql: string;
  context: Context;
  dialect: SQLDialect;
  resolvePlaceholder: (
    placeholder: string,
    placeholderNumber: number | undefined
  ) => unknown;
}): IdorViolationResult | undefined {
  const agent = getInstance();
  if (!agent) {
    return undefined;
  }

  const config = agent.getIdorProtectionConfig();
  if (!config) {
    return undefined;
  }

  if (isIdorProtectionIgnored()) {
    return undefined;
  }

  if (!context.tenantId) {
    return violation(
      "Zen IDOR protection: setTenantId() was not called for this request. Every request must have a tenant ID when IDOR protection is enabled."
    );
  }

  const analysis = getAnalysisResults(sql, dialect);

  if (!analysis) {
    return violation("Zen IDOR protection: failed to analyze SQL query");
  }

  if ("error" in analysis) {
    return violation(`Zen IDOR protection: ${analysis.error}`);
  }

  for (const queryResult of analysis.results) {
    if (queryResult.kind === "insert") {
      const insertViolation = checkInsert(
        queryResult,
        config,
        context,
        resolvePlaceholder
      );
      if (insertViolation) {
        return insertViolation;
      }
    } else {
      const whereViolation = checkWhereFilters(
        queryResult,
        config,
        context,
        resolvePlaceholder
      );
      if (whereViolation) {
        return whereViolation;
      }
    }
  }

  return undefined;
}

function checkWhereFilters(
  queryResult: SqlQueryResult,
  config: IdorProtectionConfig,
  context: Context,
  resolvePlaceholder: (
    placeholder: string,
    placeholderNumber: number | undefined
  ) => unknown
): IdorViolationResult | undefined {
  for (const table of queryResult.tables) {
    if (config.excludedTables.includes(table.name)) {
      continue;
    }

    const tenantFilter = queryResult.filters.find((f) => {
      if (f.column !== config.tenantColumnName) {
        return false;
      }
      // If qualified (e.g. u.tenant_id), match against table name or alias
      if (f.table) {
        return (
          f.table === table.name || (table.alias && f.table === table.alias)
        );
      }
      // Unqualified column (e.g. WHERE tenant_id = $1 without table prefix):
      // We can only safely attribute it to the current table when there's
      // exactly one table in the query. With multiple tables, we can't know
      // which table the unqualified column belongs to.
      return queryResult.tables.length === 1;
    });

    if (!tenantFilter) {
      return violation(
        `Zen IDOR protection: query on table '${table.name}' is missing a filter on column '${config.tenantColumnName}'`
      );
    }

    const resolvedValue = resolvePlaceholder(
      tenantFilter.value,
      tenantFilter.placeholder_number
    );
    if (
      context.tenantId !== undefined &&
      (typeof resolvedValue === "string" || typeof resolvedValue === "number")
    ) {
      const tenantIdStr = context.tenantId.toString();
      const resolvedStr = String(resolvedValue);

      if (resolvedStr !== tenantIdStr) {
        return violation(
          `Zen IDOR protection: query on table '${table.name}' filters '${config.tenantColumnName}' with value '${resolvedStr}' but tenant ID is '${tenantIdStr}'`
        );
      }
    }
  }

  return undefined;
}

function checkInsert(
  queryResult: SqlQueryResult,
  config: IdorProtectionConfig,
  context: Context,
  resolvePlaceholder: (
    placeholder: string,
    placeholderNumber: number | undefined
  ) => unknown
): IdorViolationResult | undefined {
  for (const table of queryResult.tables) {
    if (config.excludedTables.includes(table.name)) {
      continue;
    }

    if (!queryResult.insert_columns) {
      // INSERT ... SELECT without explicit columns — can't verify tenant column
      return violation(
        `Zen IDOR protection: INSERT on table '${table.name}' is missing column '${config.tenantColumnName}'`
      );
    }

    for (const row of queryResult.insert_columns) {
      const tenantCol = row.find((c) => c.column === config.tenantColumnName);

      if (!tenantCol) {
        return violation(
          `Zen IDOR protection: INSERT on table '${table.name}' is missing column '${config.tenantColumnName}'`
        );
      }

      const resolvedValue = resolvePlaceholder(
        tenantCol.value,
        tenantCol.placeholder_number
      );
      if (
        context.tenantId !== undefined &&
        (typeof resolvedValue === "string" || typeof resolvedValue === "number")
      ) {
        const tenantIdStr = context.tenantId.toString();
        const resolvedStr = String(resolvedValue);

        if (resolvedStr !== tenantIdStr) {
          return violation(
            `Zen IDOR protection: INSERT on table '${table.name}' sets '${config.tenantColumnName}' to '${resolvedStr}' but tenant ID is '${tenantIdStr}'`
          );
        }
      }
    }
  }

  return undefined;
}

const cache = new LRUMap<string, SqlQueryResult[]>(1000);

function getAnalysisResults(
  sql: string,
  dialect: SQLDialect
): { results: SqlQueryResult[] } | { error: string } | undefined {
  const cached = cache.get(sql);
  if (cached) {
    return { results: cached };
  }

  const result = wasm_idor_analyze_sql(sql, dialect.getWASMDialectInt());

  if (!result) {
    return undefined;
  }

  if (result.error) {
    return { error: result.error };
  }

  const results = result as SqlQueryResult[];
  cache.set(sql, results);

  return { results };
}

function violation(message: string): IdorViolationResult {
  return { idorViolation: true, message };
}
