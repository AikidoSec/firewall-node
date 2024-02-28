import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

export class MySQL2 implements Wrapper {
  private inspectQuery(args: unknown[]) {
    const agent = getInstance();

    if (!agent) {
      return;
    }

    const request = getContext();

    if (!request) {
      return agent.onInspectedCall({
        module: "mysql2",
        withoutContext: true,
        detectedAttack: false,
      });
    }

    if (typeof args[0] === "string" && args[0].length > 0) {
      const sql = args[0];
      checkContextForSqlInjection(sql, request, agent, "mysql2");
    }
  }

  wrap(hooks: Hooks) {
    const mysql2 = hooks.addPackage("mysql2").withVersion("^3.0.0");

    const connection = mysql2.addSubject(
      (exports) => exports.Connection.prototype
    );

    connection.inspect("query", (args) => this.inspectQuery(args));
    connection.inspect("execute", (args) => this.inspectQuery(args));
  }
}
