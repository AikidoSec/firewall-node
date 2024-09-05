//import { DataShape } from "./getDataSchema";

type DataShape = {
  type: string | string[];
  properties?: {
    [key: string]: DataShape;
  };
  items?: DataShape;
};

/**
 * Merge two data shapes into one, getting all properties from both shapes to capture optional properties.
 * If the types are different, a merge is not possible and the first shape is returned. (Except one is null, then the other is returned)
 * The first shape is preferred over the second shape because it can already contain multiple merged shapes.
 * If the types are the same, the properties of the second shape are merged into the first shape.
 */
export function mergeDataSchemas(first: DataShape, second: DataShape) {
  const result: DataShape = { ...first };

  // Can not merge different types
  if (first.type !== second.type) {
    // Prefer non-null type
    if (first.type === "null") {
      return { ...second };
    }
    return result;
  }

  if (first.properties && second.properties) {
    result.properties = { ...first.properties };

    for (const key in second.properties) {
      if (result.properties[key]) {
        result.properties[key] = mergeDataSchemas(
          result.properties[key],
          second.properties[key]
        );
      } else {
        result.properties[key] = second.properties[key];
      }
    }
  }

  if (first.items && second.items) {
    result.items = mergeDataSchemas(first.items, second.items);
  }

  return result;
}
