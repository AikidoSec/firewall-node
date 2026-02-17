import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { checkContextForIdor } from "../vulnerabilities/idor/checkContextForIdor";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectPostgres } from "../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { isPlainObject } from "../helpers/isPlainObject";
import { wrapExport } from "../agent/hooks/wrapExport";

export class Postgres implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectPostgres();

  private resolvePlaceholder(
    placeholder: string,
    _placeholderNumber: number | undefined,
    params: unknown[] | undefined
  ): unknown {
    // Postgres uses $1, $2, etc. (1-based)
    const match = placeholder.match(/^\$(\d+)$/);
    if (match && params) {
      const index = parseInt(match[1], 10) - 1;
      if (index >= 0 && index < params.length) {
        return params[index];
      }
    }

    return undefined;
  }

  private findParams(args: unknown[]): unknown[] | undefined {
    if (args.length >= 2 && Array.isArray(args[1])) {
      return args[1];
    }

    // Object format: query({ text: "...", values: [...] })
    if (
      args.length > 0 &&
      isPlainObject(args[0]) &&
      Array.isArray(args[0].values)
    ) {
      return args[0].values;
    }

    return undefined;
  }

  private inspectQuery(args: unknown[]): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql: string = args[0];
      const params = this.findParams(args);

      // Check for SQL injection first to block malicious queries before parsing SQL query for IDOR analysis
      const sqlInjectionResult = checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: "pg.query",
        dialect: this.dialect,
      });
      if (sqlInjectionResult) {
        return sqlInjectionResult;
      }

      return checkContextForIdor({
        sql,
        context,
        dialect: this.dialect,
        resolvePlaceholder: (placeholder, placeholderNumber) =>
          this.resolvePlaceholder(placeholder, placeholderNumber, params),
      });
    }

    if (
      args.length > 0 &&
      isPlainObject(args[0]) &&
      args[0].text &&
      typeof args[0].text === "string"
    ) {
      const text = args[0].text;
      const params = this.findParams(args);

      // Check for SQL injection first to block malicious queries before parsing SQL query for IDOR analysis
      const sqlInjectionResult = checkContextForSqlInjection({
        sql: text,
        context: context,
        operation: "pg.query",
        dialect: this.dialect,
      });
      if (sqlInjectionResult) {
        return sqlInjectionResult;
      }

      return checkContextForIdor({
        sql: text,
        context,
        dialect: this.dialect,
        resolvePlaceholder: (placeholder, placeholderNumber) =>
          this.resolvePlaceholder(placeholder, placeholderNumber, params),
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("pg")
      .withVersion("^7.0.0 || ^8.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapExport(exports.Client.prototype, "query", pkgInfo, {
          kind: "sql_op",
          inspectArgs: (args) => this.inspectQuery(args),
        });
      })
      .addFileInstrumentation({
        path: "lib/client.js",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "query",
            operationKind: "sql_op",
            bindContext: true,
            inspectArgs: (args) => this.inspectQuery(args),
          },
        ],
      });
  }
}
