/* eslint-disable prefer-rest-params */
import { isDeepStrictEqual } from "node:util";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { isPlainObject } from "../isPlainObject";
import { getContext, RequestContext } from "../requestContext";
import { Integration } from "./Integration";
import type { Collection } from "mongodb";

type DetectionResult =
  | { injection: true; source: "query" }
  | { injection: true; source: "body" }
  | { injection: true; source: "headers" }
  | { injection: false };

function friendlyName(source: "query" | "body" | "headers"): string {
  switch (source) {
    case "query":
      return "query parameters";
    case "body":
      return "body";
    case "headers":
      return "headers";
  }
}

const COMPARISON_OPERATORS = [
  "$eq",
  "$gt",
  "$gte",
  "$in",
  "$lt",
  "$lte",
  "$ne",
  "$nin",
];

function findInjectionInObject(
  userControlledValue: unknown,
  filter: unknown
): boolean {
  if (!isPlainObject(userControlledValue) || !isPlainObject(filter)) {
    return false;
  }

  const fields = Object.keys(filter);
  for (const field of fields) {
    const value = filter[field];

    if (field === "$and" || field === "$or" || field === "$nor") {
      if (!Array.isArray(value)) {
        continue;
      }

      if (
        value.find((nested) =>
          findInjectionInObject(userControlledValue, nested)
        )
      ) {
        return true;
      }

      continue;
    }

    if (field === "$not") {
      if (findInjectionInObject(userControlledValue, value)) {
        return true;
      }

      continue;
    }

    if (
      isPlainObject(value) &&
      Object.keys(value).length === 1 &&
      COMPARISON_OPERATORS.includes(Object.keys(value)[0]) &&
      Object.keys(userControlledValue).find((key) =>
        isDeepStrictEqual(userControlledValue[key], value)
      )
    ) {
      return true;
    }
  }

  return false;
}

export function detectInjection(
  context: RequestContext,
  filter: unknown
): DetectionResult {
  if (findInjectionInObject(context.request.body, filter)) {
    return { injection: true, source: "body" };
  }

  if (findInjectionInObject(context.request.query, filter)) {
    return { injection: true, source: "query" };
  }

  if (findInjectionInObject(context.request.headers, filter)) {
    return { injection: true, source: "headers" };
  }

  return { injection: false };
}

const OPERATIONS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "updateOne",
  "updateMany",
] as const;

type Operation = (typeof OPERATIONS)[number];

// TODO: Support more methods
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
                const result = detectInjection(context, filter);

                if (result.injection) {
                  const message = `Blocked NoSQL injection for MongoDB.Collection.${operation}(...), please check ${friendlyName(result.source)}!`;
                  context.aikido.report({
                    source: result.source,
                    message: message,
                    context: context,
                    stack: new Error().stack || "",
                    metadata: {
                      db: this.dbName,
                      collection: this.collectionName,
                      operation: operation,
                      filter: filter,
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
