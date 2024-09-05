export type DataShape = {
  type: string | string[];
  properties?: { [key: string]: DataShape };
  items?: DataShape;
};

// Maximum depth to traverse the data structure to get the shape for improved performance
const maxDepth = 20;

/**
 * Get the shape of the data (for example http json body) as a schema.
 */
export function getDataShape(data: unknown, depth = 0): DataShape {
  // If the data is not an object (or an array), return the type
  if (typeof data !== "object") {
    return { type: typeof data };
  }

  if (data === null) {
    return { type: "null" };
  }

  if (Array.isArray(data)) {
    return {
      type: "array",
      // Assume that the array is homogenous (for performance reasons)
      items: data.length > 0 ? getDataShape(data[0]) : undefined,
    };
  }

  const schema: DataShape = {
    type: "object",
    properties: {},
  };

  if (depth < maxDepth) {
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        schema.properties![key] = getDataShape(
          (data as { [index: string]: unknown })[key],
          depth + 1
        );
      }
    }
  }

  return schema;
}
