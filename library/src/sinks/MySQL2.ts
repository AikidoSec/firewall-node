import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

export class MySQL2 implements Wrapper {
  private inspectQuery(args: unknown[], agent: Agent) {
    const context = getContext();

    if (!context) {
      return;
    }

    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql = args[0];
      checkContextForSqlInjection(sql, context, agent, "mysql2");
    }
  }

  wrap(hooks: Hooks) {
    const mysql2 = hooks.addPackage("mysql2").withVersion("^3.0.0");
    const connection = mysql2.addSubject(
      (exports) => exports.Connection.prototype
    );

    connection.inspect("query", (args, subject, agent) =>
      this.inspectQuery(args, agent)
    );

    connection.inspect("execute", (args, subject, agent) =>
      this.inspectQuery(args, agent)
    );
  }
}
