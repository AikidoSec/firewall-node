import { Wrapper } from "../agent/Wrapper";
import { Client } from "pg";
import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";
import { Context, getContext } from "../agent/Context";
import { extractStringsFromContext } from "./extractStringsFromContext";
import { detectSQLInjection } from "../vulnerabilities/detectSQLInjection";

export class Postgres implements Wrapper {
  private checkForSqlInjection(sql: string, request: Context) {
    // Currently, do nothing : Still needs to be implemented
    const userInput = extractStringsFromContext(request);
    for (let i = 0; i < userInput.length; i++) {
      const result = detectSQLInjection(sql, userInput[i]);
    }
  }
  private wrapQueryFunction(exports: unknown) {
    const that = this;

    massWrap(
      // @ts-expect-error This is magic that TypeScript doesn't understand
      [exports.Client.prototype, exports.Pool.prototype],
      ["query"],
      function wrapQueryFunction(original) {
        return function safeQueryFunction(this: Client, ...args: unknown[]) {
          const agent = getInstance();
          if (!agent) {
            return original.apply(this, args);
          }

          const request = getContext();
          if (!request) {
            agent.onInspectedCall({
              module: "postgres",
              withoutContext: true,
              detectedAttack: false,
            });

            return original.apply(this, args);
          }
          if (typeof args[0] !== "string") {
            // The query is not a string, not much to do here
            return original.apply(this, args);
          }
          const querystring: string = args[0];

          that.checkForSqlInjection(querystring, request);

          return original.apply(this, args);
        };
      }
    );
  }

  private onModuleRequired<T>(exports: T): T {
    this.wrapQueryFunction(exports);
    return exports;
  }

  wrap() {
    new Hook(["pg"], this.onModuleRequired.bind(this));
  }
}
