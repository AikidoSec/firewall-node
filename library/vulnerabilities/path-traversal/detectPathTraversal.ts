import { containsUnsafePathParts } from "./containsUnsafePathParts";

export function detectPathTraversal(
  filePath: string,
  userInput: string
): boolean {
  if (userInput.length <= 1) {
    // We ignore single characters since they don't pose a big threat.
    return false;
  }

  return filePath.includes(userInput) && containsUnsafePathParts(filePath);
}
