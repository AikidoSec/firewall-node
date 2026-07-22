import type { Collection, Db } from "mongodb-v6";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import type { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { detectNoSQLInjection } from "../vulnerabilities/nosql-injection/detectNoSQLInjection";
import { isPlainObject } from "../helpers/isPlainObject";
import { Context, getContext } from "../agent/Context";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { PackageFunctionInstrumentationInstruction } from "../agent/hooks/instrumentation/types";
import { checkContextForJsInjection } from "../vulnerabilities/js-injection/checkContextForJsInjection";

// Fields in a raw command document (db.command(...) / runCommand(...)) that
// carry a NoSQL filter
const COMMAND_FIELDS_WITH_FILTER = ["filter", "query", "pipeline"] as const;

// Fields on delete/update commands: { delete: "coll", deletes: [{ q: {...} }] }
// and { update: "coll", updates: [{ q: {...}, u: {...} }] }.
const COMMAND_OPERATION_LIST_FIELDS = ["deletes", "updates"] as const;

// Server-side JS fields on the mapReduce command. These are at the top level
// of the command document (not nested inside a filter/operator)
const MAP_REDUCE_JS_FIELDS = ["map", "reduce", "finalize"] as const;

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

// Write operations that also carry user-controlled content in args[1]
const OPERATIONS_WITH_UPDATE_ARG = new Set<string>([
  "findOneAndUpdate",
  "findOneAndReplace",
  "updateOne",
  "updateMany",
  "replaceOne",
]);

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
  [key in BulkWriteOperationName]?: {
    filter?: unknown;
    update?: unknown;
    replacement?: unknown;
  };
};

export class MongoDB implements Wrapper {
  private inspectFilter(
    db: string,
    collection: string,
    request: Context,
    filter: unknown,
    operation: string,
    operationPrefix = "MongoDB.Collection"
  ): InterceptorResult {
    const result = detectNoSQLInjection(request, filter);

    if (result.injection) {
      return {
        operation: `${operationPrefix}.${operation}`,
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

      if (!options) {
        continue;
      }

      if (options.filter) {
        const result = this.inspectFilter(
          collection.dbName,
          collection.collectionName,
          context,
          options.filter,
          "bulkWrite"
        );
        if (result) {
          return result;
        }
      }

      // Also scan update (updateOne/updateMany) and replacement (replaceOne).
      for (const updateContent of [options.update, options.replacement]) {
        if (isPlainObject(updateContent) || Array.isArray(updateContent)) {
          const result = this.inspectFilter(
            collection.dbName,
            collection.collectionName,
            context,
            updateContent,
            "bulkWrite"
          );
          if (result) {
            return result;
          }
        }
      }
    }

    return undefined;
  }

  private inspectBulkOpFind(
    args: unknown[],
    bulkOp: unknown
  ): InterceptorResult {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    // v6+: this.collection; v4/v5: this.s.collection
    const bulkOpAny = bulkOp as any;
    const collection = (bulkOpAny?.collection ?? bulkOpAny?.s?.collection) as
      | Collection
      | undefined;
    if (!collection) {
      return undefined;
    }

    if (args.length > 0 && isPlainObject(args[0])) {
      return this.inspectFilter(
        collection.dbName,
        collection.collectionName,
        context,
        args[0],
        "find"
      );
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
      const result = this.inspectFilter(
        collection.dbName,
        collection.collectionName,
        context,
        args[0],
        operation
      );
      if (result) {
        return result;
      }
    }

    if (
      OPERATIONS_WITH_UPDATE_ARG.has(operation) &&
      args.length > 1 &&
      (isPlainObject(args[1]) || Array.isArray(args[1]))
    ) {
      return this.inspectFilter(
        collection.dbName,
        collection.collectionName,
        context,
        args[1],
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

  private getFunctionSource(value: unknown): string | undefined {
    if (typeof value === "string") {
      return value;
    }

    if (isPlainObject(value) && typeof value.code === "string") {
      return value.code;
    }
    return undefined;
  }

  private inspectMapReduceCommand(
    command: Record<string, unknown>,
    context: Context
  ): InterceptorResult {
    // Check possible JS injections
    for (const field of MAP_REDUCE_JS_FIELDS) {
      const source = this.getFunctionSource(command[field]);
      if (!source) {
        continue;
      }

      const result = checkContextForJsInjection({
        js: source,
        operation: "MongoDB.command",
        context,
      });
      if (result) {
        return result;
      }
    }

    return undefined;
  }

  private inspectDbCommand(args: unknown[], db: Db): InterceptorResult {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    if (args.length === 0 || !isPlainObject(args[0])) {
      return undefined;
    }

    const command = args[0];
    const collectionName = "";

    for (const field of COMMAND_FIELDS_WITH_FILTER) {
      if (field in command) {
        const result = this.inspectFilter(
          db.databaseName,
          collectionName,
          context,
          command[field],
          "command",
          "MongoDB"
        );
        if (result) {
          return result;
        }
      }
    }

    for (const listField of COMMAND_OPERATION_LIST_FIELDS) {
      const operations = command[listField];
      if (!Array.isArray(operations)) {
        continue;
      }

      for (const operation of operations) {
        if (!isPlainObject(operation)) {
          continue;
        }

        for (const key of ["q", "u"] as const) {
          if (key in operation) {
            const result = this.inspectFilter(
              db.databaseName,
              collectionName,
              context,
              operation[key],
              "command",
              "MongoDB"
            );
            if (result) {
              return result;
            }
          }
        }
      }
    }

    if ("mapReduce" in command) {
      const result = this.inspectMapReduceCommand(command, context);
      if (result) {
        return result;
      }
    }

    return undefined;
  }

  private wrapCollection(
    exports: typeof import("mongodb-v6"),
    pkgInfo: WrapPackageInfo
  ) {
    const collectionProto = exports.Collection.prototype;

    if (exports.Db?.prototype) {
      wrapExport(exports.Db.prototype, "command", pkgInfo, {
        kind: "nosql_op",
        inspectArgs: (args, agent, db) => this.inspectDbCommand(args, db as Db),
      });
    }

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

    // BulkOperationBase.prototype.find is not on Collection but on the bulk op
    // classes returned by initializeOrderedBulkOp / initializeUnorderedBulkOp.
    // Both subclasses inherit find from BulkOperationBase, so we patch it once
    // on the shared base prototype.
    if (exports.OrderedBulkOperation?.prototype) {
      const bulkOpBaseProto = Object.getPrototypeOf(
        exports.OrderedBulkOperation.prototype
      );
      if (bulkOpBaseProto?.find) {
        wrapExport(bulkOpBaseProto, "find", pkgInfo, {
          kind: "nosql_op",
          inspectArgs: (args, agent, bulkOp) =>
            this.inspectBulkOpFind(args, bulkOp),
        });
      }
    }
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
      })
      .addFileInstrumentation({
        path: "lib/bulk/common.js",
        functions: [
          {
            name: "find",
            nodeType: "MethodDefinition",
            className: "BulkOperationBase",
            operationKind: "nosql_op",
            inspectArgs: (args, agent, bulkOp) =>
              this.inspectBulkOpFind(args, bulkOp),
          },
        ],
      })
      .addFileInstrumentation({
        path: "lib/db.js",
        functions: [
          {
            name: "command",
            nodeType: "MethodDefinition",
            className: "Db",
            operationKind: "nosql_op",
            inspectArgs: (args, agent, db) =>
              this.inspectDbCommand(args, db as Db),
          },
        ],
      });
  }
}
