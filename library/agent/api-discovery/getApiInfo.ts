import { Context } from "../Context";
import { APIAuthType, getApiAuthType } from "./getApiAuthType";
import { BodyDataType, getBodyDataType } from "./getBodyDataType";
import { DataSchema, getDataSchema } from "./getDataSchema";

export type APISpec = {
  body?: APIBodyInfo;
  query?: DataSchema;
  auth?: APIAuthType[];
};

type APIBodyInfo = {
  type: BodyDataType;
  schema: DataSchema;
};

/**
 * Get body data type and schema from context.
 * Returns undefined if the body is not an object or if the body type could not be determined.
 */
export function getApiInfo(context: Context): APISpec | undefined {
  try {
    let bodyInfo: APIBodyInfo | undefined;

    if (
      context.body &&
      typeof context.body === "object" &&
      Object.keys(context.body).length > 0 &&
      !context.graphql
    ) {
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

    const authInfo = getApiAuthType(context);

    if (!bodyInfo && !queryInfo && !authInfo) {
      return undefined;
    }

    return {
      body: bodyInfo,
      query: queryInfo,
      auth: authInfo,
    };
  } catch {
    return undefined;
  }
}
