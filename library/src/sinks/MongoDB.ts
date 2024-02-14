/* eslint-disable prefer-rest-params */
import { Collection, Db } from "mongodb";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";
import { detectNoSQLInjection } from "../vulnerabilities/detectNoSQLInjection";
import { isPlainObject } from "../helpers/isPlainObject";
import { Context, getContext } from "../agent/Context";
import { friendlyName } from "../agent/Source";
import { Wrapper } from "../agent/Wrapper";

const OPERATIONS_WITH_FILTER = [
  "count",
  "countDocuments",
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

const BULK_WRITE_OPERATIONS_WITH_FILTER = [
  "replaceOne",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
] as const;

type BulkWriteOperationName =
  (typeof BULK_WRITE_OPERATIONS_WITH_FILTER)[number];

type BulkWriteOperation = {
  [key in BulkWriteOperationName]?: { filter?: unknown };
};

export class MongoDB implements Wrapper {
  private inspectFilter(
    db: string,
    collection: string,
    agent: Agent,
    request: Context,
    filter: unknown,
    operation: string
  ) {
    const result = detectNoSQLInjection(request, filter);
    agent.onInspectedCall({
      module: "mongodb",
      withoutContext: false,
      detectedAttack: result.injection,
    });

    if (result.injection) {
      agent.onDetectedAttack({
        module: "mongodb",
        kind: "nosql_injection",
        blocked: agent.shouldBlock(),
        source: result.source,
        request: request,
        stack: new Error().stack || "",
        path: result.pathToPayload,
        metadata: {
          db: db,
          collection: collection,
          operation: operation,
          filter: JSON.stringify(filter),
        },
      });

      if (agent.shouldBlock()) {
        throw new Error(
          `Aikido guard has blocked a NoSQL injection: MongoDB.Collection.${operation}(...) originating from ${friendlyName(result.source)} (${result.pathToPayload})`
        );
      }
    }
  }

  private wrapBulkWrite(exports: unknown) {
    const that = this;

    wrap(
      // @ts-expect-error This is magic that TypeScript doesn't understand
      exports.Collection.prototype,
      "bulkWrite",
      function (original) {
        return function (this: Collection) {
          const agent = getInstance();

          if (!agent) {
            return original.apply(this, arguments);
          }

          const request = getContext();

          if (!request) {
            agent.onInspectedCall({
              module: "mongodb",
              withoutContext: true,
              detectedAttack: false,
            });

            return original.apply(this, arguments);
          }

          if (!Array.isArray(arguments[0])) {
            return original.apply(this, arguments);
          }

          const operations: BulkWriteOperation[] = arguments[0];
          operations.forEach((operation) => {
            BULK_WRITE_OPERATIONS_WITH_FILTER.forEach((command) => {
              const options = operation[command];

              if (options && options.filter) {
                that.inspectFilter(
                  this.dbName,
                  this.collectionName,
                  agent,
                  request,
                  options.filter,
                  "bulkWrite"
                );
              }
            });
          });

          return original.apply(this, arguments);
        };
      }
    );
  }

  private wrapOperationsWithFilter(exports: unknown) {
    const that = this;

    OPERATIONS_WITH_FILTER.forEach((operation) => {
      wrap(
        // @ts-expect-error This is magic that TypeScript doesn't understand
        exports.Collection.prototype,
        operation,
        function (original) {
          return function (this: Collection) {
            const agent = getInstance();

            if (!agent) {
              return original.apply(this, arguments);
            }

            const hasFilter =
              arguments.length > 0 && isPlainObject(arguments[0]);

            if (!hasFilter) {
              return original.apply(this, arguments);
            }

            const request = getContext();

            if (!request) {
              agent.onInspectedCall({
                module: "mongodb",
                withoutContext: true,
                detectedAttack: false,
              });

              return original.apply(this, arguments);
            }

            const filter = arguments[0];
            that.inspectFilter(
              this.dbName,
              this.collectionName,
              agent,
              request,
              filter,
              operation
            );

            return original.apply(this, arguments);
          };
        }
      );
    });
  }

  private onModuleRequired<T>(exports: T): T {
    this.wrapBulkWrite(exports);
    this.wrapOperationsWithFilter(exports);

    return exports;
  }

  setupHooks() {
    new Hook(["mongodb"], this.onModuleRequired.bind(this));
  }
}
