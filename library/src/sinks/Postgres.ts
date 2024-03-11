import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { Context } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/checkContextForSqlInjection";

export class Postgres implements Wrapper {
  private inspectQuery(args: unknown[], context: Context): InterceptorResult {
    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql: string = args[0];

      return checkContextForSqlInjection({
        sql: sql,
        context: context,
        operation: "pg.query",
      });
    }
  }

  wrap(hooks: Hooks) {
    const pg = hooks.addPackage("pg").withVersion("^7.0.0 || ^8.0.0");

    const client = pg.addSubject((exports) => exports.Client.prototype);
    client.inspect("query", (args, subject, agent, context) =>
      this.inspectQuery(args, context)
    );
  }
}
