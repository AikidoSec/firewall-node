import { APIBodyInfo } from "./getBodyInfo";
import { mergeDataSchemas } from "./mergeDataSchemas";

/**
 * Merges two body info objects into one, getting all properties from both schemas to capture optional properties.
 */
export function updateBodyInfo(
  newBodyInfo: APIBodyInfo,
  existingBodyInfo?: APIBodyInfo
): APIBodyInfo {
  if (!existingBodyInfo) {
    return newBodyInfo;
  }

  return {
    type: newBodyInfo.type,
    schema: mergeDataSchemas(existingBodyInfo.schema, newBodyInfo.schema),
  };
}
