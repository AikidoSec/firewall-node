/* eslint-disable prefer-rest-params */
import { Collection } from "mongodb";
import { Agent } from "../agent/Agent";
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

  private inspectBulkWriteOperation(
    operation: BulkWriteOperation,
    collection: Collection,
    agent: Agent,
    context: Context
  ) {
    BULK_WRITE_OPERATIONS_WITH_FILTER.forEach((command) => {
      const options = operation[command];

      if (options && options.filter) {
        this.inspectFilter(
          collection.dbName,
          collection.collectionName,
          agent,
          context,
          options.filter,
          "bulkWrite"
        );
      }
    });
  }

  private inspectBulkWrite(
    args: unknown[],
    collection: Collection,
    agent: Agent
  ) {
    const context = getContext();

    if (!context) {
      return;
    }

    if (Array.isArray(args[0]) && args[0].length > 0) {
      const operations: BulkWriteOperation[] = args[0];
      operations.forEach((operation) => {
        this.inspectBulkWriteOperation(operation, collection, agent, context);
      });
    }
  }

  private inspectOperation(
    operation: string,
    args: unknown[],
    collection: Collection,
    agent: Agent
  ): void {
    const context = getContext();

    if (!context) {
      return;
    }

    if (args.length > 0 && isPlainObject(args[0])) {
      const filter = args[0];
      this.inspectFilter(
        collection.dbName,
        collection.collectionName,
        agent,
        context,
        filter,
        operation
      );
    }
  }

  wrap(hooks: Hooks) {
    const mongodb = hooks
      .addPackage("mongodb")
      .withVersion("^4.0.0 || ^5.0.0 || ^6.0.0");

    const collection = mongodb.addSubject(
      (exports) => exports.Collection.prototype
    );

    OPERATIONS_WITH_FILTER.forEach((operation) => {
      collection.inspect(operation, (args, collection, agent) =>
        this.inspectOperation(operation, args, collection as Collection, agent)
      );
    });

    collection.inspect("bulkWrite", (args, collection, agent) =>
      this.inspectBulkWrite(args, collection as Collection, agent)
    );
  }
}
