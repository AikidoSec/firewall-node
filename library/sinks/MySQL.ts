import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectMySQL } from "../vulnerabilities/sql-injection/dialects/SQLDialectMySQL";

export class MySQL implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectMySQL();

  private inspectQuery(args: unknown[]): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql = args[0];

      return checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: "MySQL.query",
        dialect: this.dialect,
      });
    }

    if (
      args.length > 0 &&
      isPlainObject(args[0]) &&
      args[0].sql &&
      typeof args[0].sql === "string"
    ) {
      const sql = args[0].sql;

      return checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: "MySQL.query",
        dialect: this.dialect,
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("mysql")
      .withVersion("^2.0.0")
      .onFileRequire("lib/Connection.js", (exports, pkgInfo) => {
        wrapExport(exports.prototype, "query", pkgInfo, {
          kind: "sql_op",
          inspectArgs: (args) => this.inspectQuery(args),
        });
      })
      .addFileInstrumentation({
        path: "lib/Connection.js",
        functions: [
          {
            name: "Connection.prototype.query",
            nodeType: "FunctionAssignment",
            operationKind: "sql_op",
            bindContext: true,
            inspectArgs: (args) => this.inspectQuery(args),
          },
        ],
      });
  }
}
