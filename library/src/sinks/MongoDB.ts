/* eslint-disable prefer-rest-params */
import { Collection } from "mongodb";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";
import { Hooks } from "../agent/hooks/Hooks";
import { detectNoSQLInjection } from "../vulnerabilities/nosql-injection/detectNoSQLInjection";
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

  private inspectBulkWrite(args: unknown[], collection: Collection) {
    const agent = getInstance();

    if (!agent) {
      return;
    }

    const request = getContext();

    if (!request) {
      return agent.onInspectedCall({
        module: "mongodb",
        withoutContext: true,
        detectedAttack: false,
      });
    }

    if (!Array.isArray(args[0])) {
      return;
    }

    const operations: BulkWriteOperation[] = args[0];
    operations.forEach((operation) => {
      BULK_WRITE_OPERATIONS_WITH_FILTER.forEach((command) => {
        const options = operation[command];

        if (options && options.filter) {
          this.inspectFilter(
            collection.dbName,
            collection.collectionName,
            agent,
            request,
            options.filter,
            "bulkWrite"
          );
        }
      });
    });
  }

  private inspectOperation(
    operation: string,
    args: unknown[],
    collection: Collection
  ): void {
    const agent = getInstance();

    if (!agent) {
      return;
    }

    const hasFilter = args.length > 0 && isPlainObject(args[0]);

    if (!hasFilter) {
      return;
    }

    const request = getContext();

    if (!request) {
      return agent.onInspectedCall({
        module: "mongodb",
        withoutContext: true,
        detectedAttack: false,
      });
    }

    const filter = args[0];
    this.inspectFilter(
      collection.dbName,
      collection.collectionName,
      agent,
      request,
      filter,
      operation
    );
  }

  wrap(hooks: Hooks) {
    const mongodb = hooks
      .addPackage("mongodb")
      .withVersion("^4.0.0 || ^5.0.0 || ^6.0.0");

    const collection = mongodb.addSubject(
      (exports) => exports.Collection.prototype
    );

    OPERATIONS_WITH_FILTER.forEach((operation) => {
      collection.inspect(operation, (args, collection) =>
        this.inspectOperation(operation, args, collection as Collection)
      );
    });

    collection.inspect("bulkWrite", (args, collection) =>
      this.inspectBulkWrite(args, collection as Collection)
    );
  }
}
