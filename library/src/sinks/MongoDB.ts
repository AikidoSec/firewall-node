/* eslint-disable prefer-rest-params */
import { Collection } from "mongodb";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";
import { detectNoSQLInjection } from "../vulnerabilities/nosql-injection/detectNoSQLInjection";
import { isPlainObject } from "../helpers/isPlainObject";
import { Context, getContext } from "../agent/Context";
import { friendlyName } from "../agent/Source";
import { WrapSelector, Wrapper } from "../agent/Wrapper";

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

const MONGODB_VERSION_RANGE = "^4.0.0 || ^5.0.0 || ^6.0.0";

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

export class MongoDB extends Wrapper {
  constructor() {
    //wrap
    super("mongodb", MONGODB_VERSION_RANGE, getWrapSelectors());
  }
  static inspectFilter(
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

  static protectBulkWrite(this: any, args: unknown[]) {
    const agent = getInstance();

    if (!agent) {
      return;
    }

    const request = getContext();

    if (!request) {
      agent.onInspectedCall({
        module: "mongodb",
        withoutContext: true,
        detectedAttack: false,
      });
      return;
    }

    if (!Array.isArray(args[0])) {
      return;
    }

    const operations: BulkWriteOperation[] = args[0];
    operations.forEach((operation) => {
      BULK_WRITE_OPERATIONS_WITH_FILTER.forEach((command) => {
        const options = operation[command];

        if (options && options.filter) {
          MongoDB.inspectFilter(
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
  }
  static protectQuery(this: any, args: unknown[], operation: string) {
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
      agent.onInspectedCall({
        module: "mongodb",
        withoutContext: true,
        detectedAttack: false,
      });

      return;
    }

    const filter = args[0];
    MongoDB.inspectFilter(
      this.dbName,
      this.collectionName,
      agent,
      request,
      filter,
      operation
    );

    return;
  }
}

function getWrapSelectors() {
  const wrapSelectors: Record<string, WrapSelector> = {};

  // Add bulkWrite
  wrapSelectors["bulkWrite"] = {
    exportsSelector: (exports: any) => [exports.Collection.prototype],
    middleware: MongoDB.protectBulkWrite,
  };

  // Add operations with filter
  OPERATIONS_WITH_FILTER.forEach((operation) => {
    wrapSelectors[operation] = {
      exportsSelector: (exports: any) => [exports.Collection.prototype],
      middleware: MongoDB.protectQuery,
    };
  });

  return wrapSelectors;
}
