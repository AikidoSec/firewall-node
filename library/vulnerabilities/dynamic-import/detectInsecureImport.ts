import { containsUnsafePathParts } from "../path-traversal/containsUnsafePathParts";

export function detectInsecureImport(
  specifier: string,
  userInput: string
): boolean {
  if (userInput.length <= 1) {
    // We ignore single characters since they don't pose a big threat.
    return false;
  }

  if (userInput.length > specifier.length) {
    // We ignore cases where the user input is longer than the specifier.
    // Because the user input can't be part of the specifier.
    return false;
  }

  if (!specifier.includes(userInput)) {
    // We ignore cases where the user input is not part of the specifier.
    return false;
  }

  if (userInput === specifier) {
    return true;
  }

  // Todo: Support file:// urls (../ already resolved)
  if (
    containsUnsafePathParts(specifier) &&
    containsUnsafePathParts(userInput)
  ) {
    return true;
  }

  return false;
}
