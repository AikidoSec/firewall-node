/**
 * The getPackageVersion module exports only one function : {@link getPackageVersion}
 * @module helpers/getPackageVersion
 */

/**
 * Get the installed version of a package
 * @param pkg A package name
 * @returns The version accourding to the package.json file of that package, if not defined returns null
 */
export function getPackageVersion(pkg: string) {
  try {
    return require(`${pkg}/package.json`).version;
  } catch (error) {
    return null;
  }
}
