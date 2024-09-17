import type { Context } from "../Context";
import type { Route } from "../Routes";
import { APIAuthType } from "./getApiAuthType";
import { APIBodyInfo, getApiInfo } from "./getApiInfo";
import { DataSchema } from "./getDataSchema";
import { mergeApiAuthTypes } from "./mergeApiAuthTypes";
import { mergeDataSchemas } from "./mergeDataSchemas";

/**
 * Updates the body, query, and auth info of an existing route with new info from the context.
 */
export function updateApiInfo(context: Context, existingRoute: Route): void {
  const {
    body: newBody,
    query: newQuery,
    auth: newAuth,
  } = getApiInfo(context) || {};

  // Merge body schemas if both exists, otherwise set the new body schema if it exists
  if (existingRoute.body && newBody) {
    existingRoute.body = {
      type: newBody.type,
      schema: mergeDataSchemas(existingRoute.body?.schema, newBody.schema),
    };
  } else if (newBody) {
    existingRoute.body = newBody;
  }

  if (
    newQuery &&
    typeof newQuery === "object" &&
    Object.keys(newQuery).length > 0
  ) {
    if (existingRoute.query && newQuery) {
      existingRoute.query = mergeDataSchemas(existingRoute.query, newQuery);
    } else {
      existingRoute.query = newQuery;
    }
  }

  existingRoute.auth = mergeApiAuthTypes(existingRoute.auth, newAuth);
}
