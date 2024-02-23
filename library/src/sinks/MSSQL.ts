import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { WrapSelector, Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

const MSSQL_VERSION_RANGE = "^10.0.0"; // Current version as of development

export class MSSQL extends Wrapper {
  constructor() {
    const queryWrapSelector: WrapSelector = {
      exportsSelector: (exports: any) => [exports.prototype],
      middleware: MSSQL.middleware,
    };

    super("mssql", MSSQL_VERSION_RANGE, {
      query: queryWrapSelector,
    });
  }
  static middleware(args: unknown[], operation: string) {
    console.log("Middleware was called")
    const agent = getInstance();
    if (!agent) {
      return;
    }

    const request = getContext();
    if (!request) {
      agent.onInspectedCall({
        module: "mssql",
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

    checkContextForSqlInjection(querystring, request, agent, "mssql");
  }
}
