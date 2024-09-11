import { Context } from "../Context";
import { isJsonContentType } from "../../helpers/isJsonContentType";

export type BodyDataType =
  | "json"
  | "form-urlencoded"
  | "form-data"
  | "xml"
  | undefined;

/**
 * Tries to determine the type of the body data based on the content type header.
 */
export function getBodyDataType(headers: Context["headers"]): BodyDataType {
  if (typeof headers !== "object" || headers === null) {
    return;
  }
  let contentType = headers["content-type"];
  if (!contentType) {
    return;
  }

  if (Array.isArray(contentType)) {
    // Choose the first content type if there are multiple, express will discard duplicates
    contentType = contentType[0];
  }

  if (isJsonContentType(contentType)) {
    return "json";
  }

  if (contentType.startsWith("application/x-www-form-urlencoded")) {
    return "form-urlencoded";
  }

  if (contentType.startsWith("multipart/form-data")) {
    return "form-data";
  }

  if (contentType.includes("xml")) {
    return "xml";
  }

  return undefined;
}
