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

const MAX_BODY_SIZE_BYTES = 1024 * 1024; // 1 MB

function isBodyTooLarge(headers: Context["headers"]): boolean {
  if (typeof headers !== "object" || headers === null) {
    return false;
  }
  let contentLength = headers["content-length"];
  if (Array.isArray(contentLength)) {
    contentLength = contentLength[0];
  }
  if (!contentLength) {
    return false;
  }
  const size = parseInt(contentLength, 10);
  return !isNaN(size) && size > MAX_BODY_SIZE_BYTES;
}

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
      !context.graphql &&
      !isBodyTooLarge(context.headers)
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
