import type { Context } from "../Context";
import { APIBodyInfo, getApiInfo } from "./getApiInfo";
import { DataSchema } from "./getDataSchema";
import { mergeDataSchemas } from "./mergeDataSchemas";

/**
 * Merges two body info objects into one, getting all properties from both schemas to capture optional properties.
 * If the body info is not defined, the existing body info is returned (if any).
 * If there is no existing body info, but the new body info is defined, the new body info is returned without merging.
 */
export function updateApiInfo(
  context: Context,
  existingBodyInfo?: APIBodyInfo,
  existingQueryInfo?: DataSchema
):
  | {
      body?: APIBodyInfo;
      query?: DataSchema;
    }
  | undefined {
  const { body: newBody, query: newQuery } = getApiInfo(context) || {};

  let bodyInfo = existingBodyInfo;

  // Merge body schemas if both exists, otherwise set the new body schema if it exists
  if (existingBodyInfo && newBody) {
    bodyInfo = {
      type: newBody.type,
      schema: mergeDataSchemas(existingBodyInfo?.schema, newBody.schema),
    };
  } else if (newBody) {
    bodyInfo = newBody;
  }

  let queryInfo = existingQueryInfo;
  if (
    newQuery &&
    typeof newQuery === "object" &&
    Object.keys(newQuery).length > 0
  ) {
    if (existingQueryInfo && newQuery) {
      queryInfo = mergeDataSchemas(existingQueryInfo, newQuery);
    } else {
      queryInfo = newQuery;
    }
  }

  return {
    body: bodyInfo,
    query: queryInfo,
  };
}
