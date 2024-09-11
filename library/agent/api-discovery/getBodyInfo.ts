import { isFeatureEnabled } from "../../helpers/featureFlags";
import { Context } from "../Context";
import { BodyDataType, getBodyDataType } from "./getBodyDataType";
import { DataSchema, getDataSchema } from "./getDataSchema";

export type APIBodyInfo = {
  type: BodyDataType;
  schema: DataSchema;
};

/**
 * Get body data type and schema from context.
 * Returns undefined if the body is not an object or if the body type could not be determined.
 */
export function getBodyInfo(context: Context): APIBodyInfo | undefined {
  // Check if feature flag COLLECT_API_SCHEMA is enabled
  if (!isFeatureEnabled("COLLECT_API_SCHEMA")) {
    return undefined;
  }
  if (!context.body || typeof context.body !== "object") {
    // Ignore body if it's not an object and only a primitive (string, number, etc.)
    return undefined;
  }
  try {
    return {
      type: getBodyDataType(context.headers),
      schema: getDataSchema(context.body),
    };
  } catch {
    return undefined;
  }
}
