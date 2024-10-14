import { getMaxApiDiscoverySamples } from "../../helpers/getMaxApiDiscoverySamples";
import type { Context } from "../Context";
import type { Route } from "../Routes";
import { getApiInfo } from "./getApiInfo";
import { mergeApiAuthTypes } from "./mergeApiAuthTypes";
import { mergeDataSchemas } from "./mergeDataSchemas";

/**
 * Updates the body, query, and auth info of an existing route with new info from the context.
 * Only the first 10 hits of a route during one heartbeat window are sampled.
 */
export function updateApiInfo(context: Context, existingRoute: Route): void {
  const maxSamples = getMaxApiDiscoverySamples();

  // Only sample first x hits of a route during one heartbeat window
  // Default is 10
  if (existingRoute.hits > maxSamples) {
    return;
  }

  try {
    const {
      body: newBody,
      query: newQuery,
      auth: newAuth,
    } = getApiInfo(context) || {};

    const existingSpec = existingRoute.apispec;

    // Merge body schemas if both exists, otherwise set the new body schema if it exists
    if (existingSpec.body && newBody) {
      existingSpec.body = {
        type: newBody.type,
        schema: mergeDataSchemas(existingSpec.body?.schema, newBody.schema),
      };
    } else if (newBody) {
      existingSpec.body = newBody;
    }

    if (
      newQuery &&
      typeof newQuery === "object" &&
      Object.keys(newQuery).length > 0
    ) {
      if (existingSpec.query && newQuery) {
        existingSpec.query = mergeDataSchemas(existingSpec.query, newQuery);
      } else {
        existingSpec.query = newQuery;
      }
    }

    existingSpec.auth = mergeApiAuthTypes(existingSpec.auth, newAuth);

    // Normalize empty apispec so we do not get something like { auth: undefined }
    if (!existingSpec.body && !existingSpec.query && !existingSpec.auth) {
      existingRoute.apispec = {};
    }
  } catch {
    // ignore
  }
}
