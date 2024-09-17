import { isFeatureEnabled } from "../../helpers/featureFlags";
import { Context } from "../Context";
import { APIAuthType, getApiAuthType } from "./getApiAuthType";
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
export function getApiInfo(context: Context):
  | {
      body?: APIBodyInfo;
      query?: DataSchema;
      auth?: APIAuthType[];
    }
  | undefined {
  // Check if feature flag COLLECT_API_SCHEMA is enabled
  if (!isFeatureEnabled("COLLECT_API_SCHEMA")) {
    return undefined;
  }

  try {
    let bodyInfo: APIBodyInfo | undefined;
    if (context.body && typeof context.body === "object") {
      bodyInfo = {
        type: getBodyDataType(context.headers),
        schema: getDataSchema(context.body),
      };
    }

    let queryInfo: DataSchema | undefined;
    if (
      context.query &&
      typeof context.query === "object" &&
      Object.keys(context.query).length > 0
    ) {
      queryInfo = getDataSchema(context.query);
    }

    return {
      body: bodyInfo,
      query: queryInfo,
      auth: getApiAuthType(context),
    };
  } catch {
    return undefined;
  }
}
