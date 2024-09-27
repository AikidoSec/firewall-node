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
  items?: DataSchema;
};

// Maximum depth to traverse the data structure to get the schema for improved performance
const maxDepth = 20;
// Maximum number of properties per level
const maxProperties = 100;

/**
 * Get the schema of the data (for example http json body) as a schema.
 */
export function getDataSchema(data: unknown, depth = 0): DataSchema {
  // If the data is not an object (or an array), return the type
  if (typeof data !== "object") {
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
      items: data.length > 0 ? getDataSchema(data[0]) : undefined,
    };
  }

  const schema: DataSchema = {
    type: "object",
    properties: {},
  };

  // If the depth is less than the maximum depth, get the schema for each property
  if (depth < maxDepth) {
    let propertiesCount = 0;
    for (const key in data) {
      if (propertiesCount >= maxProperties) {
        break;
      }
      propertiesCount++;
      if (data.hasOwnProperty(key)) {
        schema.properties![key] = getDataSchema(
          (data as { [index: string]: unknown })[key],
          depth + 1
        );
      }
    }
  }

  return schema;
}
