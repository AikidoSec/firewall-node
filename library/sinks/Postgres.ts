import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectPostgres } from "../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { isPlainObject } from "../helpers/isPlainObject";
import { wrapExport } from "../agent/hooks/wrapExport";

export class Postgres implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectPostgres();

  private inspectQuery(args: unknown[]): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql: string = args[0];

      return checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: "pg.query",
        dialect: this.dialect,
      });
    }

    if (
      args.length > 0 &&
      isPlainObject(args[0]) &&
      args[0].text &&
      typeof args[0].text === "string"
    ) {
      const text = args[0].text;

      return checkContextForSqlInjection({
        sql: text,
        context: context,
        operation: "pg.query",
        dialect: this.dialect,
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
