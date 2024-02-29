import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

export class Postgres implements Wrapper {
  private inspectQuery(args: unknown[], agent: Agent) {
    const context = getContext();

    if (!context) {
      return;
    }

    if (args.length > 0 && typeof args[0] === "string" && args[0].length > 0) {
      const sql: string = args[0];
      checkContextForSqlInjection(sql, context, agent, "postgres");
    }
  }

  wrap(hooks: Hooks) {
    const pg = hooks.addPackage("pg").withVersion("^7.0.0 || ^8.0.0");

    const client = pg.addSubject((exports) => exports.Client.prototype);
    client.inspect("query", (args, subject, agent) =>
      this.inspectQuery(args, agent)
    );
  }
}
