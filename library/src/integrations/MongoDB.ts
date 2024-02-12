/* eslint-disable prefer-rest-params */
import type { Collection } from "mongodb";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getInstance } from "../agent/AgentSingleton";
import { detectNoSQLInjection } from "../vulnerabilities/detectNoSQLInjection";
import { isPlainObject } from "../helpers/isPlainObject";
import { getContext } from "../agent/Context";
import { friendlyName } from "../agent/Source";
import { Integration } from "./Integration";

const OPERATIONS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "deleteOne",
  "deleteMany",
  "updateOne",
  "updateMany",
  "replaceOne",
] as const;

type Operation = (typeof OPERATIONS)[number];

export class MongoDB implements Integration {
  getPackageName(): string {
    return "mongodb";
  }

  setup(): boolean {
    new Hook(["mongodb"], (exports) => {
      OPERATIONS.forEach((operation) => {
        wrap<Collection, Operation>(
          // @ts-expect-error This is magic that TypeScript doesn't understand
          exports.Collection.prototype,
          operation,
          // @ts-expect-error This is magic that TypeScript doesn't understand
          function (original) {
            return function (this: Collection) {
              const agent = getInstance();

              if (!agent) {
                // @ts-expect-error This is magic that TypeScript doesn't understand
                return original.apply(this, arguments);
              }

              const hasFilter =
                arguments.length > 0 && isPlainObject(arguments[0]);

              if (hasFilter) {
                const request = getContext();

                if (request) {
                  const filter = arguments[0];
                  const result = detectNoSQLInjection(request, filter);
                  agent.inspectedCall({
                    module: "mongodb",
                    withoutContext: false,
                    detectedAttack: result.injection,
                  });

                  if (result.injection) {
                    agent.detectedAttack({
                      module: "mongodb",
                      kind: "nosql_injection",
                      blocked: agent.shouldBlock(),
                      source: result.source,
                      request: request,
                      stack: new Error().stack || "",
                      path: result.path,
                      metadata: {
                        db: this.dbName,
                        collection: this.collectionName,
                        operation: operation,
                        filter: JSON.stringify(filter),
                      },
                    });

                    if (agent.shouldBlock()) {
                      throw new Error(
                        `Aikido guard has blocked a NoSQL injection: MongoDB.Collection.${operation}(...) originating from ${friendlyName(result.source)} (${result.path})`
                      );
                    }
                  }
                } else {
                  agent.inspectedCall({
                    module: "mongodb",
                    withoutContext: true,
                    detectedAttack: false,
                  });
                }
              }

              // @ts-expect-error This is magic that TypeScript doesn't understand
              return original.apply(this, arguments);
            };
          }
        );
      });

      return exports;
    });

    return true;
  }
}
