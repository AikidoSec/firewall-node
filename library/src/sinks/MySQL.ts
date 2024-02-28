import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

export class MySQL implements Wrapper {
  private inspectQuery(args: unknown[]) {
    const agent = getInstance();

    if (!agent) {
      return;
    }

    const request = getContext();

    if (!request) {
      return agent.onInspectedCall({
        module: "mysql",
        withoutContext: true,
        detectedAttack: false,
      });
    }

    if (typeof args[0] === "string") {
      const sql = args[0];
      checkContextForSqlInjection(sql, request, agent, "mysql");
    }
  }

  wrap(hooks: Hooks) {
    const mysql = hooks.addPackage("mysql").withVersion("^2.0.0");

    const connection = mysql
      .addFile("lib/Connection")
      .addSubject((exports) => exports.prototype);

    connection.inspect("query", (args) => this.inspectQuery(args));
  }
}
