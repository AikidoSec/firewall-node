import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectClickHouse } from "../vulnerabilities/sql-injection/dialects/SQLDialectClickHouse";

export class ClickHouse implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectClickHouse();

  private inspectQuery(operation: string, args: unknown[]): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (
      args.length > 0 &&
      args[0] &&
      typeof args[0] === "object" &&
      !Array.isArray(args[0]) &&
      "query" in args[0] &&
      typeof args[0].query === "string"
    ) {
      return checkContextForSqlInjection({
        operation: operation,
        sql: args[0].query,
        context: context,
        dialect: this.dialect,
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    const methodsToWrap = ["query", "command", "exec"];

    hooks
      .addPackage("@clickhouse/client-common")
      .withVersion("^1.0.0")
      .onFileRequire("dist/client.js", (exports, pkgInfo) => {
        for (const method of methodsToWrap) {
          wrapExport(exports.ClickHouseClient.prototype, method, pkgInfo, {
            kind: "sql_op",
            inspectArgs: (args) => this.inspectQuery(method, args),
          });
        }
      })
      .addFileInstrumentation({
        path: "dist/client.js",
        functions: methodsToWrap.map((method) => ({
          name: method,
          nodeType: "MethodDefinition",
          operationKind: "sql_op",
          inspectArgs: (args) => this.inspectQuery(method, args),
        })),
      });
  }
}
