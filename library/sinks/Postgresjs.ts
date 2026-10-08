import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectPostgres } from "../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { wrapExport } from "../agent/hooks/wrapExport";
import { checkContextForIdor } from "../vulnerabilities/idor/checkContextForIdor";

export class Postgresjs implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectPostgres();

  private resolvePlaceholder(
    placeholder: string,
    params: unknown[] | undefined
  ): unknown {
    const match = /^\$(\d+)$/.exec(placeholder);
    if (!match || !params) {
      return undefined;
    }

    return params[Number.parseInt(match[1], 10) - 1];
  }

  private isTaggedTemplate(obj: unknown): obj is TemplateStringsArray {
    return Array.isArray(obj) && "raw" in obj && typeof obj.raw === "object";
  }

  private isPostgresHelper(value: unknown): boolean {
    // Postgres.js helper objects (like sql(identifier)) have a 'strings' property
    return (
      value !== null &&
      typeof value === "object" &&
      "strings" in value &&
      Array.isArray((value as any).strings)
    );
  }

  private extractPostgresHelperValue(value: unknown): string | undefined {
    // Extract the value from a postgres.js helper object
    // For identifiers like sql('table_name'), the value is in strings[0]
    if (!this.isPostgresHelper(value)) {
      return undefined;
    }
    const strings = (value as any).strings;
    if (strings.length > 0) {
      // Join all strings (for simple identifiers, there's usually just one)
      return strings.join("");
    }
    return undefined;
  }

  private extractSqlAndParamsFromTaggedTemplate(
    args: unknown[]
  ): { sql: string; params: unknown[] } | undefined {
    if (args.length === 0 || !this.isTaggedTemplate(args[0])) {
      return undefined;
    }

    const strings = args[0] as TemplateStringsArray;
    const values = args.slice(1);

    let sql = "";
    const params: unknown[] = [];
    let paramIndex = 1;

    for (let i = 0; i < strings.length; i++) {
      sql += strings[i];
      if (i < values.length) {
        const value = values[i];
        // Check if this is a postgres.js helper (like sql(identifier))
        const helperValue = this.extractPostgresHelperValue(value);
        if (helperValue !== undefined) {
          // Inline the identifier (postgres.js would quote it, but for parsing we can use it as-is)
          sql += helperValue;
        } else {
          // Regular value - parameterize it
          sql += `$${paramIndex}`;
          params.push(value);
          paramIndex++;
        }
      }
    }

    return { sql, params };
  }

  private inspectQuery(args: unknown[]): InterceptorResult {
    let sql: string;
    let params: unknown[] | undefined;
    let operation: string;

    // Check if this is a tagged template call
    const taggedTemplateResult = this.extractSqlAndParamsFromTaggedTemplate(args);
    if (taggedTemplateResult) {
      sql = taggedTemplateResult.sql;
      params = taggedTemplateResult.params;
      operation = "sql``";
    } else {
      // This is a regular string call (e.g., sql.unsafe)
      if (typeof args[0] !== "string" || args[0].length === 0) {
        return undefined;
      }
      sql = args[0];
      params = Array.isArray(args[1]) ? args[1] : undefined;
      operation = "sql.unsafe";
    }

    const context = getContext();

    if (context) {
      const sqlInjectionResult = checkContextForSqlInjection({
        sql,
        context,
        operation,
        dialect: this.dialect,
      });
      if (sqlInjectionResult) {
        return sqlInjectionResult;
      }
    }

    return checkContextForIdor({
      sql,
      dialect: this.dialect,
      resolvePlaceholder: (placeholder) =>
        this.resolvePlaceholder(placeholder, params),
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("postgres")
      .withVersion("^3.0.0")
      .onRequire((exports, pkgInfo) => {
        return wrapExport(exports, undefined, pkgInfo, {
          kind: undefined,
          modifyReturnValue: (args, returnValue) => {
            // Wrap the callable SQL tag function itself
            wrapExport(returnValue, undefined, pkgInfo, {
              kind: "sql_op",
              inspectArgs: (args) => this.inspectQuery(args),
            });
            // Also wrap the unsafe method
            wrapExport(returnValue, "unsafe", pkgInfo, {
              kind: "sql_op",
              inspectArgs: (args) => this.inspectQuery(args),
            });
            return returnValue;
          },
        });
      })
      .addMultiFileInstrumentation(
        [
          "src/index.js", // ESM
          "cjs/src/index.js", // CJS
        ],
        [
          {
            name: "unsafe",
            nodeType: "FunctionDeclaration",
            operationKind: "sql_op",
            inspectArgs: (args) => this.inspectQuery(args),
          },
        ]
      );
  }
}
