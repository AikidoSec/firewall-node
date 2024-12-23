import { normalize } from "path";

/**
 * Get all matching path segments from the end of the url path and the file path
 * While the url could include a route where the file is served, e.g. /static/abc/test.txt, the file path could be /app/data/abc/test.txt
 */
export function getMatchingPathEnding(
  urlPath: string,
  filePath: string
): string | undefined {
  // Normalize slashes to forward slashes for comparison
  const normalizedUrlPath = normalize(urlPath);
  const normalizedFilePath = normalize(filePath).replace(/\\/g, "/");

  const reversedUrlParts = normalizedUrlPath.split("/").reverse();
  const reversedFileParts = normalizedFilePath.split("/").reverse();

  // Create one array with all matching segments from the url path beginning from the end
  // We can not simply check using filePath.endsWith(urlPath) because the static files could be served in a subdirectory
  const matchingParts = [];

  for (let i = 0; i < reversedUrlParts.length; i++) {
    // Break if we reached the beginning of the file path
    if (i >= reversedFileParts.length) {
      break;
    }

    // If the parts match, add it to the matching parts
    if (reversedUrlParts[i] === reversedFileParts[i]) {
      matchingParts.push(reversedUrlParts[i]);
      continue;
    }

    // Break at the first non-matching part
    break;
  }

  if (matchingParts.length === 0) {
    return undefined;
  }

  const matchingStr = matchingParts.reverse().join("/");
  if (!matchingStr.startsWith("/")) {
    return `/${matchingStr}`;
  }
  return matchingStr;
}
