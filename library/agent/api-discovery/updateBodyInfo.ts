import type { Context } from "../Context";
import { APIBodyInfo, getBodyInfo } from "./getBodyInfo";
import { mergeDataSchemas } from "./mergeDataSchemas";

/**
 * Merges two body info objects into one, getting all properties from both schemas to capture optional properties.
 * If the body info is not defined, the existing body info is returned (if any).
 * If there is no existing body info, but the new body info is defined, the new body info is returned without merging.
 */
export function updateBodyInfo(
  context: Context,
  existingBodyInfo?: APIBodyInfo
): APIBodyInfo | undefined {
  const newBodyInfo = getBodyInfo(context);
  if (!newBodyInfo) {
    return existingBodyInfo;
  }

  if (!existingBodyInfo) {
    return newBodyInfo;
  }

  return {
    type: newBodyInfo.type,
    schema: mergeDataSchemas(existingBodyInfo.schema, newBodyInfo.schema),
  };
}
