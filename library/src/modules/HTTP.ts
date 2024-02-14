import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getInstance } from "../agent/AgentSingleton";
import { Module } from "./Module";

export class HTTP implements Module {
  getPackageName(): string {
    return "http";
  }

  isBuiltIn(): boolean {
    return true;
  }

  setup(): boolean {
    for (const module of ["http", "https"]) {
      new Hook([module], (exports) => {
        wrap(exports, "request", function (original) {
          return function () {
            const agent = getInstance();

            if (!agent || arguments.length === 0) {
              return original.apply(this, arguments);
            }

            const url = arguments[0];

            if (typeof url === "string" && url.startsWith("http")) {
              try {
                const parsed = new URL(url);
                agent.onConnectDomain({
                  module: module,
                  domain: parsed.host,
                });
              } catch (error) {
                // Ignore
              }
            }

            return original.apply(this, arguments);
          };
        });

        return exports;
      });
    }

    wrap(global, "fetch", function (original) {
      return function () {
        const agent = getInstance();

        if (!agent || arguments.length === 0) {
          return original.apply(this, arguments);
        }

        const url = arguments[0];

        if (typeof url === "string" && url.startsWith("http")) {
          try {
            const parsed = new URL(url);
            agent.onConnectDomain({
              module: "fetch",
              domain: parsed.host,
            });
          } catch (error) {
            // Ignore
          }
        }

        return original.apply(this, arguments);
      };
    });

    return true;
  }
}
