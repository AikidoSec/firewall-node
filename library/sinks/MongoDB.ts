/* eslint-disable prefer-rest-params */
import { Collection } from "mongodb";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { detectNoSQLInjection } from "../vulnerabilities/nosql-injection/detectNoSQLInjection";
import { isPlainObject } from "../helpers/isPlainObject";
import { Context } from "../agent/Context";
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
    request: Context,
    filter: unknown,
    operation: string
  ): InterceptorResult {
    const result = detectNoSQLInjection(request, filter);

    if (result.injection) {
      return {
        operation: `MongoDB.Collection.${operation}`,
        kind: "nosql_injection",
        source: result.source,
        pathToPayload: result.pathToPayload,
        metadata: {
          db: db,
          collection: collection,
          operation: operation,
          filter: JSON.stringify(filter),
        },
        payload: result.payload,
      };
    }
  }

  private inspectBulkWriteOperation(
    operation: BulkWriteOperation,
    collection: Collection,
    context: Context
  ): InterceptorResult {
    for (const op of BULK_WRITE_OPERATIONS_WITH_FILTER) {
      const options = operation[op];

      if (options && options.filter) {
        return this.inspectFilter(
          collection.dbName,
          collection.collectionName,
          context,
          options.filter,
          "bulkWrite"
        );
      }
    }

    return undefined;
  }

  private inspectBulkWrite(
    args: unknown[],
    collection: Collection,
    context: Context
  ) {
    if (Array.isArray(args[0]) && args[0].length > 0) {
      const operations: BulkWriteOperation[] = args[0];

      for (const operation of operations) {
        const result = this.inspectBulkWriteOperation(
          operation,
          collection,
          context
        );

        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  private inspectOperation(
    operation: string,
    args: unknown[],
    collection: Collection,
    context: Context
  ): InterceptorResult {
    if (args.length > 0 && isPlainObject(args[0])) {
      const filter = args[0];

      return this.inspectFilter(
        collection.dbName,
        collection.collectionName,
        context,
        filter,
        operation
      );
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    const mongodb = hooks
      .addPackage("mongodb")
      .withVersion("^4.0.0 || ^5.0.0 || ^6.0.0");

    const collection = mongodb.addSubject(
      (exports) => exports.Collection.prototype
    );

    OPERATIONS_WITH_FILTER.forEach((operation) => {
      collection.inspect(operation, (args, collection, agent, context) =>
        this.inspectOperation(
          operation,
          args,
          collection as Collection,
          context
        )
      );
    });

    collection.inspect("bulkWrite", (args, collection, agent, context) =>
      this.inspectBulkWrite(args, collection as Collection, context)
    );
  }
}