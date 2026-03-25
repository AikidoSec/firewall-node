import type { Collection } from "mongodb-v6";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import type { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { detectNoSQLInjection } from "../vulnerabilities/nosql-injection/detectNoSQLInjection";
import { isPlainObject } from "../helpers/isPlainObject";
import { Context, getContext } from "../agent/Context";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { PackageFunctionInstrumentationInstruction } from "../agent/hooks/instrumentation/types";

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
        pathsToPayload: result.pathsToPayload,
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

  private wrapCollection(
    exports: typeof import("mongodb-v6"),
    pkgInfo: WrapPackageInfo
  ) {
    const collectionProto = exports.Collection.prototype;

    OPERATIONS_WITH_FILTER.forEach((operation) => {
      wrapExport(collectionProto, operation, pkgInfo, {
        kind: "nosql_op",
        inspectArgs: (args, agent, collection) =>
          this.inspectOperation(operation, args, collection as Collection),
      });
    });

    wrapExport(collectionProto, "bulkWrite", pkgInfo, {
      kind: "nosql_op",
      inspectArgs: (args, agent, collection) =>
        this.inspectBulkWrite(args, collection as Collection),
    });

    wrapExport(collectionProto, "aggregate", pkgInfo, {
      kind: "nosql_op",
      inspectArgs: (args, agent, collection) =>
        this.inspectAggregate(args, collection as Collection),
    });

    wrapExport(collectionProto, "distinct", pkgInfo, {
      kind: "nosql_op",
      inspectArgs: (args, agent, collection) =>
        this.inspectDistinct(args, collection as Collection),
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("mongodb")
      .withVersion("^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0")
      .onRequire((exports, pkgInfo) => {
        // From mongodb v6.10.0, the Collection is undefined
        // It's defined like:
        // exports.Collection = void 0;
        // const collection_1 = require("./collection");
        // Object.defineProperty(exports, "Collection", { enumerable: true, get: function () { return collection_1.Collection; } });
        // So we need to wait for the next tick to wrap the Collection
        process.nextTick(() => {
          this.wrapCollection(exports, pkgInfo);
        });
      })
      .addFileInstrumentation({
        path: "lib/collection.js",
        functions: [
          ...OPERATIONS_WITH_FILTER.map(
            (operation): PackageFunctionInstrumentationInstruction => ({
              name: operation,
              nodeType: "MethodDefinition",
              operationKind: "nosql_op",
              inspectArgs: (args, agent, collection) =>
                this.inspectOperation(
                  operation,
                  args,
                  collection as Collection
                ),
            })
          ),
          {
            name: "bulkWrite",
            nodeType: "MethodDefinition",
            operationKind: "nosql_op",
            inspectArgs: (args, agent, collection) =>
              this.inspectBulkWrite(args, collection as Collection),
          },
          {
            name: "aggregate",
            nodeType: "MethodDefinition",
            operationKind: "nosql_op",
            inspectArgs: (args, agent, collection) =>
              this.inspectAggregate(args, collection as Collection),
          },
          {
            name: "distinct",
            nodeType: "MethodDefinition",
            operationKind: "nosql_op",
            inspectArgs: (args, agent, collection) =>
              this.inspectDistinct(args, collection as Collection),
          },
        ],
      });
  }
}
