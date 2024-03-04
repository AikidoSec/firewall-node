import { Agent } from "../agent/Agent";
import { Context } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

export class MySQL implements Wrapper {
  private inspectQuery(args: unknown[], agent: Agent, context: Context) {
    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql = args[0];
      checkContextForSqlInjection(sql, context, agent, "mysql");
    }
  }

  wrap(hooks: Hooks) {
    const mysql = hooks.addPackage("mysql").withVersion("^2.0.0");

    const connection = mysql
      .addFile("lib/Connection")
      .addSubject((exports) => exports.prototype);

    connection.inspect("query", (args, subject, agent, context) =>
      this.inspectQuery(args, agent, context)
    );
  }
}
