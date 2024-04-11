import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialect } from "../vulnerabilities/sql-injection/dialects/SQLDialect";
import { SQLDialectPostgres } from "../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";

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

    return undefined;
  }

  wrap(hooks: Hooks) {
    const pg = hooks.addPackage("pg").withVersion("^7.0.0 || ^8.0.0");

    const client = pg.addSubject((exports) => exports.Client.prototype);
    client.inspect("query", (args) => this.inspectQuery(args));
  }
}
