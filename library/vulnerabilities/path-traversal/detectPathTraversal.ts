import { containsUnsafePathParts } from "./containsUnsafePathParts";

export function detectPathTraversal(
  filePath: string,
  userInput: string
): boolean {
  if (userInput.length <= 1) {
    // We ignore single characters since they don't pose a big threat.
    return false;
  }

  if (userInput.length > filePath.length) {
    // We ignore cases where the user input is longer than the file path.
    // Because the user input can't be part of the file path.
    return false;
  }

  return filePath.includes(userInput) && containsUnsafePathParts(filePath);
}
