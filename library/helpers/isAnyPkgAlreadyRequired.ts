import { getModuleInfoFromPath } from "../agent/hooks/getModuleInfoFromPath";
import type { Package } from "../agent/hooks/Package";

/**
 * Checks if any passed package was already required in the current process.
 */
export function isAnyPkgAlreadyRequired(supportedPkgs: Package[]) {
  const supportedPkgNames = supportedPkgs.map((pkg) => pkg.getName());

  const alreadyRequiredModuleFiles = Object.keys(require.cache).filter((pkg) =>
    pkg.includes("node_modules")
  );

  for (const file of alreadyRequiredModuleFiles) {
    const moduleInfo = getModuleInfoFromPath(file);
    if (moduleInfo && supportedPkgNames.includes(moduleInfo.name)) {
      return true;
    }
  }

  return false;
}
