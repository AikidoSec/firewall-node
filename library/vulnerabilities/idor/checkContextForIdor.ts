import { getInstance } from "../../agent/AgentSingleton";
import { Context } from "../../agent/Context";
import { isIdorProtectionIgnored } from "../../agent/context/withoutIdorProtection";
import { IdorViolationResult } from "../../agent/hooks/InterceptorResult";
import { LRUMap } from "../../ratelimiting/LRUMap";
import { tryParseJSON } from "../../helpers/tryParseJSON";
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

  const results = getAnalysisResults(sql, dialect);

  if (!results) {
    return violation("Zen IDOR protection: failed to analyze SQL query");
  }

  for (const queryResult of results) {
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
      // Unqualified: only match if there's a single table
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
      resolvedValue !== undefined &&
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
        resolvedValue !== undefined &&
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
): SqlQueryResult[] | undefined {
  const cached = cache.get(sql);
  if (cached) {
    return cached;
  }

  const json = wasm_idor_analyze_sql(sql, dialect.getWASMDialectInt());
  const parsed = tryParseJSON(json);

  if (!parsed || parsed.error) {
    return undefined;
  }

  const results = parsed as SqlQueryResult[];
  cache.set(sql, results);

  return results;
}

function violation(message: string): IdorViolationResult {
  return { idorViolation: true, message };
}
