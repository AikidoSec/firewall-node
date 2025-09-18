import { getPackageVersionFromPath } from "../agent/hooks/instrumentation/getPackageVersionFromPath";
import { getModuleInfoFromPath } from "../agent/hooks/getModuleInfoFromPath";

/**
 * Get the installed version of a package
 */
export function getPackageVersion(pkg: string): string | undefined {
  try {
    const entrypoint = require.resolve(pkg);

    const moduleInfo = getModuleInfoFromPath(entrypoint);
    if (!moduleInfo) {
      return undefined;
    }

    return getPackageVersionFromPath(moduleInfo.base);
  } catch {
    return undefined;
  }
}
