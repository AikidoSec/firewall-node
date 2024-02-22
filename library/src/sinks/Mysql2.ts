import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { WrapSelector, Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

const EXAMPLE_PACKAGE_VERSION_RANGE = "^3.9.0";

export class Mysql2 extends Wrapper {
  constructor() {
    const queryWrapSelector: WrapSelector = {
      exportsSelector: (exports: any) => [exports.Connection.prototype],
      middleware: Mysql2.middleware,
    };

    super("mysql2", EXAMPLE_PACKAGE_VERSION_RANGE, {
      execute: queryWrapSelector,
      query: queryWrapSelector,
    });
  }
  static middleware(args: unknown[]) {
    const agent = getInstance();
    if (!agent) {
      return;
    }

    const request = getContext();
    if (!request) {
      agent.onInspectedCall({
        module: "mysql2",
        withoutContext: true,
        detectedAttack: false,
      });

      return;
    }
    if (typeof args[0] !== "string") {
      // The query is not a string, not much to do here
      return;
    }
    const querystring: string = args[0];

    checkContextForSqlInjection(querystring, request, agent, "mysql2");
  }
}
