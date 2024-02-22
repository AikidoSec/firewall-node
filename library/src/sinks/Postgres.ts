import { WrapSelector, Wrapper } from "../agent/Wrapper";
import { Client } from "pg";
import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";
import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { checkContextForSqlInjection } from "../vulnerabilities/sql-injection/detectSQLInjection";

const PG_PACKAGE_VERSION_RANGE = "^8.11.0";

export class Postgres extends Wrapper {
  constructor() {
    const postgresWrapSelector: WrapSelector = {
      exportsSelector: (exports: any) => [
        exports.Client.prototype,
        exports.Pool.prototype,
      ],
      middleware: Postgres.middleware,
    };

    super("pg", PG_PACKAGE_VERSION_RANGE, {
      query: postgresWrapSelector,
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
        module: "postgres",
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

    checkContextForSqlInjection(querystring, request, agent, "postgres");
  }
}
