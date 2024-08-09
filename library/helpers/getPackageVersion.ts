import { sep } from "path";
import { getOrignalRequire } from "../agent/hooks/wrapRequire";

/**
 * Get the installed version of a package
 */
export function getPackageVersion(pkg: string): string | null {
  try {
    const path = require.resolve(pkg);
    const parts = path.split(sep);

    // e.g. @google-cloud/functions-framework
    const pkgParts = pkg.split("/");
    let lookup = pkgParts[0];
    if (pkgParts.length > 1) {
      lookup = pkgParts[1];
    }

    // Normally we can just require(`${pkg}/package.json`)
    // but @google-cloud/functions-framework is a special case
    // the package.json contains "exports" which results in the following error:
    // Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './package.json' is not defined by "exports"
    // Thus we manually build the path to the package.json
    const index = parts.indexOf(lookup);
    const root = parts.slice(0, index + 1).join(sep);

    return getOrignalRequire()(`${path}/package.json`).version;
  } catch (error) {
    return null;
  }
}
