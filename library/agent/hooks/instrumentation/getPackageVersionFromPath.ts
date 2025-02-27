/**
 * Get the installed version of a package
 */
export function getPackageVersionFromPath(
  basePath: string
): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`${basePath}/package.json`).version;
  } catch {
    // Return undefined if the package is not found
  }
}
