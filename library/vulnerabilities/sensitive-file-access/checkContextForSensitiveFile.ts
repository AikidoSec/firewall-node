import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { pathToString } from "../../helpers/pathToString";
import { isSensitiveFile } from "./isSensitiveFile";
import { getMatchingPathEnding } from "./getMatchingPathEnding";
import { tryParseURLPath } from "../../helpers/tryParseURLPath";

/**
 * Check if the current request is trying to access a sensitive file
 */
export function checkContextForSensitiveFileAccess({
  filename,
  context,
  operation,
}: {
  filename: string | URL | Buffer;
  context: Context;
  operation: string;
}): InterceptorResult {
  const filePathString = pathToString(filename);
  if (!filePathString || !context.url) {
    return;
  }

  const path = tryParseURLPath(context.url);
  if (!path) {
    return undefined;
  }

  const matchingPathEnding = getMatchingPathEnding(path, filePathString);

  if (!matchingPathEnding) {
    return;
  }

  if (isSensitiveFile(matchingPathEnding)) {
    return {
      operation: operation,
      kind: "sensitive_file_access",
      source: "url",
      pathsToPayload: ["."],
      metadata: {
        filename: filePathString,
      },
      payload: path,
    };
  }
}
