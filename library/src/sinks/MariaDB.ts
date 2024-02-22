import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { WrapSelector, Wrapper } from "../agent/Wrapper";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

const MARIADB_PACKAGE_VERSION = "^3.2.0";

export class MariaDB extends Wrapper {
  constructor() {
    const functionWrapSelector: WrapSelector = {
      exportsSelector: (exports: any) => [exports.myObject.prototype],
      middleware: MariaDB.middleware,
    };

    super("mariadb", MARIADB_PACKAGE_VERSION, {
      my_function: functionWrapSelector,
    });
  }
  static middleware(args: unknown[], operation: string) {
    const agent = getInstance();
    if (!agent) {
      return;
    }

    const request = getContext();
    if (!request) {
      agent.onInspectedCall({
        module: "mariadb",
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

    checkContextForSqlInjection(querystring, request, agent, "mariadb");
  }
}
