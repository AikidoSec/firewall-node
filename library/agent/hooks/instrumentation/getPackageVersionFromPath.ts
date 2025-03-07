import { readFileSync } from "fs";

/**
 * Get the installed version of a package
 */
export function getPackageVersionFromPath(
  basePath: string
): string | undefined {
  try {
    return JSON.parse(readFileSync(`${basePath}/package.json`, "utf8")).version;
  } catch {
    // Return undefined if the package is not found
  }
}
