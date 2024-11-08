/* eslint-disable prefer-rest-params */
import type { Collection } from "mongodb";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { detectNoSQLInjection } from "../vulnerabilities/nosql-injection/detectNoSQLInjection";
import { isPlainObject } from "../helpers/isPlainObject";
import { Context, getContext } from "../agent/Context";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";

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

  private inspectBulkWrite(args: unknown[], collection: Collection) {
    const context = getContext();

    if (!context) {
      return undefined;
    }

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

  private inspectAggregate(args: unknown[], collection: Collection) {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (Array.isArray(args) && args.length > 0) {
      const pipeline = args[0];

      return this.inspectFilter(
        collection.dbName,
        collection.collectionName,
        context,
        pipeline,
        "aggregate"
      );
    }

    return undefined;
  }

  private inspectOperation(
    operation: string,
    args: unknown[],
    collection: Collection
  ): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

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

  private inspectDistinct(
    args: unknown[],
    collection: Collection
  ): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 1 && isPlainObject(args[1])) {
      const filter = args[1];

      return this.inspectFilter(
        collection.dbName,
        collection.collectionName,
        context,
        filter,
        "distinct"
      );
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("mongodb")
      // 6.10.x lazy loads the Collection class
      // Mark as unsupported for now, until we find a fix
      .withVersion(
        "^4.0.0 || ^5.0.0 || ~6.0.0 || ~6.1.0 || ~6.2.0 || ~6.3.0 || ~6.4.0 || ~6.5.0 || ~6.6.0 || ~6.7.0 || ~6.8.0 || ~6.9.0"
      )
      .onRequire((exports, pkgInfo) => {
        const collectionProto = exports.Collection.prototype;

        OPERATIONS_WITH_FILTER.forEach((operation) => {
          wrapExport(collectionProto, operation, pkgInfo, {
            inspectArgs: (args, agent, collection) =>
              this.inspectOperation(operation, args, collection as Collection),
          });
        });

        wrapExport(collectionProto, "bulkWrite", pkgInfo, {
          inspectArgs: (args, agent, collection) =>
            this.inspectBulkWrite(args, collection as Collection),
        });

        wrapExport(collectionProto, "aggregate", pkgInfo, {
          inspectArgs: (args, agent, collection) =>
            this.inspectAggregate(args, collection as Collection),
        });

        wrapExport(collectionProto, "distinct", pkgInfo, {
          inspectArgs: (args, agent, collection) =>
            this.inspectDistinct(args, collection as Collection),
        });
      });
  }
}
