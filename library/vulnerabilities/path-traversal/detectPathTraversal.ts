import { normalize } from "path";
import { isWindows } from "../../helpers/isWindows";
import { containsUnsafePathParts } from "./containsUnsafePathParts";
import { startsWithUnsafePath } from "./unsafePathStart";

export function detectPathTraversal(
  filePath: string,
  userInput: string,
  checkPathStart = true,
  isUrl = false
): boolean {
  if (userInput.length <= 1) {
    // We ignore single characters since they don't pose a big threat.
    return false;
  }

  // Check for URL path traversal
  // Reason: new URL("file:///../../test.txt") => /test.txt
  // The normal check for relative path traversal will fail in this case, because transformed path does not contain ../.
  // For absolute path traversal, we dont need to check the transformed path, because it will always start with /.
  // Also /./ is checked by normal absolute path traversal check (if #219 is merged)
  if (isUrl && containsUnsafePathParts(userInput)) {
    const filePathFromUrl = parseAsFileUrl(userInput);
    if (filePathFromUrl && filePath.includes(filePathFromUrl)) {
      return true;
    }
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

/**
 * This function is used to convert a file path as a URL to a file path.
 * It is used to handle cases where a URL object is passed to a fs function.
 * For example new URL("file:///../../test.txt") => file:///test.txt
 * This function will convert ../../test.txt to /test.txt
 * If the URL is not a file URL, it will return undefined.
 * Another sample: new URL("file:///./test.txt") => /test.txt
 */
function parseAsFileUrl(path: string) {
  let url = path;

  // Remove leading file:
  if (url.startsWith("file:")) {
    url = url.slice(5);
  }

  if (!url.startsWith("/")) {
    url = "/" + url;
  }

  try {
    const normalizePath = normalize(url);
    if (isWindows) {
      // Replace backslashes with forward slashes
      return normalizePath.replace(/\\/g, "/");
    }
    return normalizePath;
  } catch (e) {
    //
  }
  return undefined;
}
