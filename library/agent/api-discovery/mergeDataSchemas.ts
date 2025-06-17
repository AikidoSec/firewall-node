import { DataSchema } from "./getDataSchema";
import { onlyContainsPrimitiveTypes } from "./isPrimitiveType";

/**
 * Merge two data schemas into one, getting all properties from both schemas to capture optional properties.
 * If the types are different, only primitive types are merged.
 * Merging of arrays with objects or objects / arrays with primitive types is not supported.
 * In this case the first schema is preferred over the second schema because it can already contain multiple merged schemas.
 * If the types are the same, the properties of the second schema are merged into the first schema.
 */
export function mergeDataSchemas(first: DataSchema, second: DataSchema) {
  const result: DataSchema = { ...first };

  // Can not merge different types
  if (!isSameType(first.type, second.type)) {
    return mergeTypes(first, second);
  }

  if (first.properties && second.properties) {
    result.properties = { ...first.properties };

    for (const key in second.properties) {
      if (result.properties[key]) {
        if (!["__proto__", "constructor", "prototype"].includes(key)) {
          result.properties[key] = mergeDataSchemas(
            result.properties[key],
            second.properties[key]
          );
        }
      } else {
        result.properties[key] = second.properties[key];
        // If a property is not in the first schema, we can assume it is optional
        // because we only store schemas for requests with status 2xx
        result.properties[key].optional = true;
      }
    }

    for (const key in first.properties) {
      // Check if removed in second schema
      if (!second.properties[key]) {
        result.properties[key].optional = true;
      }
    }
  }

  if (first.items && second.items) {
    result.items = mergeDataSchemas(first.items, second.items);
  }

  if (first.format && second.format && first.format !== second.format) {
    // If the formats are different, we can not merge them
    // So we set format to undefined because we are not sure anymore
    result.format = undefined;
  }

  if (!first.format && second.format) {
    result.format = second.format;
  }

  return result;
}

/**
 * Check if both types are the same.
 */
function isSameType(
  first: string | string[],
  second: string | string[]
): boolean {
  if (Array.isArray(first) && Array.isArray(second)) {
    return doTypeArraysMatch(first, second);
  }

  if (Array.isArray(first) && !Array.isArray(second)) {
    return doTypeArraysMatch(first, [second]);
  }

  if (!Array.isArray(first) && Array.isArray(second)) {
    return doTypeArraysMatch([first], second);
  }

  return first === second;
}

/**
 * Compare two arrays of types and ignore the order.
 */
function doTypeArraysMatch(first: string[], second: string[]): boolean {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((type) => second.includes(type));
}

/**
 * Merge types into one schema if they are different.
 */
function mergeTypes(first: DataSchema, second: DataSchema): DataSchema {
  // Currently we do not support merging arrays and other objects and arrays / objects with primitive types
  if (
    !onlyContainsPrimitiveTypes(first.type) ||
    !onlyContainsPrimitiveTypes(second.type)
  ) {
    // Prefer non-null type
    if (first.type === "null") {
      return second;
    }
    return first;
  }

  first.type = mergeTypeArrays(first.type, second.type);
  return first;
}

function mergeTypeArrays(first: string | string[], second: string | string[]) {
  if (!Array.isArray(first)) {
    first = [first];
  }

  if (!Array.isArray(second)) {
    second = [second];
  }

  return Array.from(new Set([...first, ...second]));
}
