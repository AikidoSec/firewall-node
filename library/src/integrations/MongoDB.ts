/* eslint-disable prefer-rest-params */
import type { Collection } from "mongodb";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getInstance } from "../AgentSingleton";
import { detectNoSQLInjection } from "../detectNoSQLInjection";
import { isPlainObject } from "../isPlainObject";
import { getContext } from "../Context";
import { friendlyName } from "../Source";
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
          // @ts-expect-error Exports are not typed properly
          exports.Collection.prototype,
          operation,
          // @ts-expect-error Something about a missing _id in the document
          function (original) {
            return function (this: Collection) {
              const request = getContext();
              const agent = getInstance();

              if (!request || !agent) {
                // @ts-expect-error Something about this context
                return original.apply(this, arguments);
              }

              if (arguments.length > 0 && isPlainObject(arguments[0])) {
                const filter = arguments[0];
                const result = detectNoSQLInjection(request, filter);

                if (result.injection) {
                  agent.detectedAttack({
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
                      `Blocked NoSQL injection for MongoDB.Collection.${operation}(...), please check ${friendlyName(result.source)} (${result.path})!`
                    );
                  }
                }
              }

              // @ts-expect-error Something about this context
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
