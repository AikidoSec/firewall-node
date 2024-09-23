import { containsUnsafePathParts } from "./containsUnsafePathParts";
import { startsWithUnsafePath } from "./unsafePathStart";
import { fileURLToPath } from "url";

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
      console.log("url");
      console.log("filePath", filePath);
      console.log("userInput", userInput);
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
    console.log("relative");
    console.log("filePath", filePath);
    console.log("userInput", userInput);
    return true;
  }

  if (checkPathStart) {
    // Check for absolute path traversal
    const res = startsWithUnsafePath(filePath, userInput);
    if (res) {
      console.log("absolute");
      console.log("filePath", filePath);
      console.log("userInput", userInput);
    }
    return res;
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
  if (!url.startsWith("file:")) {
    if (!url.startsWith("/")) {
      url = `/${url}`;
    }
    url = `file://${url}`;
  }
  try {
    return fileURLToPath(url);
  } catch (e) {
    //
  }
  return undefined;
}
