import { isDeepStrictEqual } from "node:util";
import { isPlainObject } from "./isPlainObject";
import { tryDecodeAsJWT } from "./jwt";
import { Request } from "./RequestContext";

// TODO: Add path to value in body (e.g. body.title)
// TODO: Add which query parameter (name, value) like in headers
type DetectionResult =
  | { injection: true; source: "query" }
  | { injection: true; source: "body" }
  | { injection: true; source: "headers" }
  | { injection: false };

export function friendlyName(source: "query" | "body" | "headers"): string {
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
] as const;

type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

function findValueInUserControllerValue(
  userControlledValue: unknown,
  filterPart: Record<string, unknown>
): boolean {
  if (isDeepStrictEqual(userControlledValue, filterPart)) {
    return true;
  }

  if (typeof userControlledValue === "string") {
    const jwt = tryDecodeAsJWT(userControlledValue);
    if (jwt && findValueInUserControllerValue(jwt, filterPart)) {
      return true;
    }
  }

  if (isPlainObject(userControlledValue)) {
    const fields = Object.keys(userControlledValue);
    for (const field of fields) {
      if (
        findValueInUserControllerValue(userControlledValue[field], filterPart)
      ) {
        return true;
      }
    }
  }

  return false;
}

function findInjectionInObject(
  userControlledValue: unknown,
  filter: unknown
): boolean {
  if (!isPlainObject(filter)) {
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
      COMPARISON_OPERATORS.includes(
        Object.keys(value)[0] as ComparisonOperator
      ) &&
      findValueInUserControllerValue(userControlledValue, value)
    ) {
      return true;
    }
  }

  return false;
}

export function detectNoSQLInjection(
  request: Request,
  filter: unknown
): DetectionResult {
  if (findInjectionInObject(request.body, filter)) {
    return { injection: true, source: "body" };
  }

  if (findInjectionInObject(request.query, filter)) {
    return { injection: true, source: "query" };
  }

  if (findInjectionInObject(request.headers, filter)) {
    return { injection: true, source: "headers" };
  }

  return { injection: false };
}
