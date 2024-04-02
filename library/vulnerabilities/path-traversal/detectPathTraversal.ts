import { containsUnsafePathParts } from "./containsUnsafePathParts";

export function detectPathTraversal(
  filePath: string,
  userInput: string
): boolean {
  if (userInput.length <= 1) {
    // We ignore single characters since they don't pose a big threat.
    // TODO: evaluate if relevant/desired for path traversal
    return false;
  }

  // TODO: logic below is not enough, since the filePath passed to fs can already have been resolved,
  // and will no longer match with user input
  if (!filePath.includes(userInput)) {
    return false;
  }

  return containsUnsafePathParts(filePath);
}
