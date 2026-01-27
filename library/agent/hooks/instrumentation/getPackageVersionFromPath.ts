import { readFileSync } from "fs";

const cache = new Map<string, string | undefined>();

/**
 * Get the installed version of a package
 */
export function getPackageVersionFromPath(
  basePath: string
): string | undefined {
  // This function is called for every file of an imported package, so we cache the result
  if (cache.has(basePath)) {
    return cache.get(basePath);
  }

  try {
    const version = JSON.parse(
      readFileSync(`${basePath}/package.json`, "utf8")
    ).version;
    cache.set(basePath, version);
    return version;
  } catch {
    // Return undefined if the package is not found
    cache.set(basePath, undefined);
  }
}
