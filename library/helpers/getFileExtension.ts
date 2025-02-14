import { extname } from "path";

/**
 * Get the file extension from a path / path segment without the dot
 */
export function getFileExtension(segment: string) {
  const extension = extname(segment);
  if (extension && extension.startsWith(".")) {
    // Remove the dot from the extension
    return extension.slice(1);
  }
  return extension;
}
