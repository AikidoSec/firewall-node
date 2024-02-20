import { Wrapper } from "../agent/Wrapper";
import { Client } from "pg";
import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";
import { Context, getContext } from "../agent/Context";
import { extractStringsFromContext } from "./extractStringsFromContext";

export class Postgres implements Wrapper {
  private checkForSqlInjection(sql: string, request: Context) {
    // Currently, do nothing : Still needs to be implemented
    const userInput = extractStringsFromContext(request);
    for (let i = 0; i < userInput.length; i++) {
      if (!inputPossibleSql(userInput[i])) {
        continue;
      }
      if (!sqlContainsInput(sql, userInput[i])) {
        continue;
      }
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

/**
 * This function is the first check in order to determine if a SQL injection is happening,
 * If the user input contains the necessary characters or words for a SQL injection, this
 * function returns true.
 * @param input The user input you want to check
 * @returns True when this is a posible SQL Injection
 */
export function inputPossibleSql(input: string): boolean {
  const regex =
    /(?<![a-z0-9])(INSERT|SELECT|CREATE|DROP|DATABASE|UPDATE|DELETE|ALTER|GRANT|SAVEPOINT|COMMIT|ROLLBACK|TRUNCATE|OR|AND|UNION|AS|WHERE)(?![a-z0-9])|(\=|;|\'|\"|\`|--)/gim; // Needs to be an actual regex
  return regex.test(input);
}

/**
 * This function is the 2nd and last check to determine if a SQL injection is happening,
 * If the sql statement contains user input, this function returns true (case-insensitive)
 * @param sql The SQL Statement you want to check it against
 * @param input The user input you want to check
 * @returns True when the sql statement contains the input
 */
export function sqlContainsInput(sql: string, input: string) {
  const lowercaseSql = sql.toLowerCase();
  const lowercaseInput = input.toLowerCase();
  return lowercaseSql.includes(lowercaseInput);
}
