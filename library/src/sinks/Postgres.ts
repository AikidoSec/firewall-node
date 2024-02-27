import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

export class Postgres implements Wrapper {
  private inspectQuery(args: unknown[]) {
    const agent = getInstance();

    if (!agent) {
      return;
    }

    const request = getContext();

    if (!request) {
      return agent.onInspectedCall({
        module: "postgres",
        withoutContext: true,
        detectedAttack: false,
      });
    }

    if (typeof args[0] !== "string") {
      // The query is not a string, not much to do here
      return;
    }

    const querystring: string = args[0];
    checkContextForSqlInjection(querystring, request, agent, "postgres");
  }

  wrap(hooks: Hooks) {
    const pg = hooks.package("pg").withVersion("^7.0.0 || ^8.0.0");

    const client = pg.subject((exports) => exports.Client.prototype);
    client.inspect("query", (args) => this.inspectQuery(args));

    const pool = pg.subject((exports) => exports.Pool.prototype);
    pool.inspect("query", (args) => this.inspectQuery(args));
  }
}
