import type { SQLDialect } from "../../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectPostgres } from "../../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";

function isTaggedTemplate(
  value: unknown
): value is { strings: unknown[]; values: unknown[] } {
  if (
    !value ||
    typeof value !== "object" ||
    !("strings" in value) ||
    !Array.isArray(value.strings) ||
    value.strings.length === 0
  ) {
    return false;
  }

  if (!value.strings.every((s) => typeof s === "string")) {
    return false;
  }

  if (!("values" in value) || !Array.isArray(value.values)) {
    return false;
  }

  return true;
}

export function extractSQLFromObject(
  obj: unknown,
  dialect: SQLDialect
): string | undefined {
  if (
    Array.isArray(obj) &&
    obj.length > 0 &&
    typeof obj[0] === "string" &&
    obj[0].length > 0
  ) {
    return obj[0];
  }

  if (isTaggedTemplate(obj)) {
    return extractSQLFromTaggedTemplate(obj, dialect);
  }
}

function extractSQLFromTaggedTemplate(
  template: { strings: unknown[]; values: unknown[] },
  dialect: SQLDialect
): string | undefined {
  const { strings, values } = template;

  let sql = "";
  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < values.length) {
      // Check if the value is a nested Prisma.raw() fragment (also a tagged template)
      if (isTaggedTemplate(values[i])) {
        // Recursively extract SQL from nested raw fragments
        const nestedSQL = extractSQLFromTaggedTemplate(
          values[i] as { strings: unknown[]; values: unknown[] },
          dialect
        );
        if (nestedSQL) {
          sql += nestedSQL;
        } else {
          // If we can't extract SQL from the nested fragment, use a placeholder
          sql += getPlaceholderForDialect(dialect, i);
        }
      } else {
        // For regular values, use a placeholder
        sql += getPlaceholderForDialect(dialect, i);
      }
    }
  }
  return sql;
}

function getPlaceholderForDialect(dialect: SQLDialect, index: number): string {
  if (
    dialect.getHumanReadableName() ===
    SQLDialectPostgres.prototype.getHumanReadableName()
  ) {
    return `$${index + 1}`;
  }
  return "?";
}
