import { containsUnsafePathParts } from "./containsUnsafePathParts";
import { startsWithUnsafePath } from "./unsafePathStart";

export function detectPathTraversal(
  filePath: string,
  userInput: string,
  checkPathStart = true
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

  if (!filePath.includes(userInput)) {
    // We ignore cases where the user input is not part of the file path.
    return false;
  }

  if (containsUnsafePathParts(filePath) && containsUnsafePathParts(userInput)) {
    return true;
  }

  if (checkPathStart) {
    // Check for absolute path traversal
    return startsWithUnsafePath(filePath, userInput);
  }

  return false;
}
