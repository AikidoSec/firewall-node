import { Agent } from "../agent/Agent";
import { Context } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

export class MySQL2 implements Wrapper {
  private inspectQuery(
    operation: string,
    args: unknown[],
    context: Context
  ): InterceptorResult {
    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql = args[0];

      return checkContextForSqlInjection({
        operation: operation,
        sql: sql,
        context: context,
      });
    }
  }

  wrap(hooks: Hooks) {
    const mysql2 = hooks.addPackage("mysql2").withVersion("^3.0.0");
    const connection = mysql2.addSubject(
      (exports) => exports.Connection.prototype
    );

    connection.inspect("query", (args, subject, agent, context) =>
      this.inspectQuery("mysql2.query", args, context)
    );

    connection.inspect("execute", (args, subject, agent, context) =>
      this.inspectQuery("mysql2.execute", args, context)
    );
  }
}