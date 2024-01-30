/* eslint-disable prefer-rest-params */
import type { Collection } from "mongodb";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { detectNoSQLInjection } from "../detectNoSQLInjection";
import { isPlainObject } from "../isPlainObject";
import { getContext } from "../RequestContext";
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
  setup(): void {
    new Hook(["mongodb"], (exports) => {
      OPERATIONS.forEach((operation) => {
        wrap<Collection, Operation>(
          // @ts-expect-error Exports are not typed properly
          exports.Collection.prototype,
          operation,
          // @ts-expect-error Something about a missing _id in the document
          function (original) {
            return function (this: Collection) {
              const context = getContext();

              if (!context) {
                // @ts-expect-error Something about this context
                return original.apply(this, arguments);
              }

              if (arguments.length > 0 && isPlainObject(arguments[0])) {
                const filter = arguments[0];
                const result = detectNoSQLInjection(context.request, filter);

                if (result.injection) {
                  const message = `Blocked NoSQL injection for MongoDB.Collection.${operation}(...), please check ${friendlyName(result.source)} (${result.path})!`;
                  context.aikido.report({
                    source: result.source,
                    kind: "nosql-injection",
                    request: context.request,
                    stack: new Error().stack || "",
                    path: result.path,
                    metadata: {
                      db: this.dbName,
                      collection: this.collectionName,
                      operation: operation,
                      filter: JSON.stringify(filter),
                    },
                  });

                  throw new Error(message);
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
  }
}
