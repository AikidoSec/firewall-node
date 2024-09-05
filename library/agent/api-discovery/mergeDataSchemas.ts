import { DataSchema } from "./getDataSchema";

/**
 * Merge two data schemas into one, getting all properties from both schemas to capture optional properties.
 * If the types are different, a merge is not possible and the first schema is returned. (Except one is null, then the other is returned)
 * The first schema is preferred over the second schema because it can already contain multiple merged schemas.
 * If the types are the same, the properties of the second schema are merged into the first schema.
 */
export function mergeDataSchemas(first: DataSchema, second: DataSchema) {
  const result: DataSchema = { ...first };

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
