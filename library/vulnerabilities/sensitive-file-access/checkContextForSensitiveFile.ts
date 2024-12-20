import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { pathToString } from "../../helpers/pathToString";
import { isSensitiveFile } from "./isSensitiveFile";
import { getMatchingPathEnding } from "./getMatchingPathEnding";

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
  if (!filePathString) {
    return;
  }

  if (!context.route) {
    return;
  }

  const matchingPathEnding = getMatchingPathEnding(
    context.route,
    filePathString
  );

  if (!matchingPathEnding) {
    return;
  }

  if (isSensitiveFile(matchingPathEnding)) {
    return {
      operation: operation,
      kind: "sensitive_file_access",
      source: "route",
      pathsToPayload: ["."],
      metadata: {
        filename: filePathString,
      },
      payload: context.route,
    };
  }
}
