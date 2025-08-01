import { getStringFormat, type StringFormat } from "./getStringFormat";

export type DataSchema = {
  /**
   * Type of this property.
   * e.g. "string", "number", "object", "array", "null"
   */
  type: string | string[];
  /**
   * If this property is optional., if not set, we don't know if it is optional or not.
   */
  optional?: boolean;
  /**
   * Map of properties for an object containing the DataSchema for each property.
   */
  properties?: { [key: string]: DataSchema };
  /**
   * Data schema for the items of an array.
   */
  items?: DataSchema | null;
  /**
   * Format of the string, if it is a string.
   */
  format?: StringFormat;
};

// Maximum depth to traverse the data structure to get the schema for improved performance
const maxDepth = 20;
// Maximum number of properties per level
const maxProperties = 100;
// Maximum property key length
const maxPropertyKeyLength = 100;

/**
 * Get the schema of the data (for example http json body) as a schema.
 */
export function getDataSchema(data: unknown, depth = 0): DataSchema {
  // If the data is not an object (or an array), return the type
  if (typeof data !== "object") {
    if (typeof data === "string") {
      const format = getStringFormat(data);
      if (format) {
        return { type: "string", format };
      }
    }
    return { type: typeof data };
  }

  // typeof null is object, but we want to treat it as null
  if (data === null) {
    return { type: "null" };
  }

  if (Array.isArray(data)) {
    return {
      type: "array",
      // Assume that the array is homogenous (for performance reasons)
      items: data.length > 0 ? getDataSchema(data[0]) : null,
    };
  }

  const schema: DataSchema = {
    type: "object",
    properties: {},
  };

  // If the depth is less than the maximum depth, get the schema for each property
  if (depth < maxDepth) {
    let propertiesCount = 0;
    for (const key of Object.keys(data)) {
      if (propertiesCount >= maxProperties) {
        break;
      }

      if (key.length > maxPropertyKeyLength) {
        continue; // Skip keys that are too long
      }

      propertiesCount++;
      schema.properties![key] = getDataSchema(
        (data as { [index: string]: unknown })[key],
        depth + 1
      );
    }
  }

  return schema;
}
