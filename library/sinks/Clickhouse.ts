import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { wrap } from "../helpers/wrap";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectClickhouse } from "../vulnerabilities/sql-injection/dialects/SQLDialectClickhouse";

export class Clickhouse implements Wrapper {
  private readonly dialect: SQLDialect = new SQLDialectClickhouse();

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
    const clickhouse = hooks
      .addPackage("@clickhouse/client")
      .withVersion("^1.0.0");

    clickhouse
      .addSubject((exports) => {
        console.log(exports);
        return exports;
      })
      .inspectResult("createClient", (args, result, subject, agent) => {
        wrap(result, "query", (original) => {
          return function (...args: unknown[]) {
            const result = this.inspectQuery(args);

            return original.apply(this, args);
          };
        });
      });
  }
}
