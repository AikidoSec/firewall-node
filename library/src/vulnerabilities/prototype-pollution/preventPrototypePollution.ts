import { getInstance } from "../../agent/AgentSingleton";
import { getPackageVersion } from "../../helpers/getPackageVersion";
import { satisfiesVersion } from "../../helpers/satisfiesVersion";

type PackageName = string;
type PackageRange = string;
type PackageVersion = string;

const INCOMPATIBLE_PACKAGE: Record<PackageName, PackageRange> = {
  mongoose: "^1.0.0 || ^2.0.0 || ^3.0.0 || ^4.0.0",
};

export function preventPrototypePollution() {
  const result = freezeBuiltinsIfPossible(INCOMPATIBLE_PACKAGE);
  const agent = getInstance();

  /* c8 ignore next 3 */
  if (!result.success) {
    agent?.unableToPreventPrototypePollution(result.incompatiblePackages);
    return;
  }

  agent?.onPrototypePollutionPrevented();
}

type FreezeResult =
  | { success: true }
  | {
      success: false;
      incompatiblePackages: Record<PackageName, PackageVersion>;
    };

export function freezeBuiltinsIfPossible(
  incompatiblePackageVersions: Record<PackageName, PackageRange>
): FreezeResult {
  const incompatiblePackages: Record<PackageName, PackageVersion> = {};
  for (const pkg in incompatiblePackageVersions) {
    const version = getPackageVersion(pkg);

    if (!version) {
      continue;
    }

    const ranges = incompatiblePackageVersions[pkg];

    if (satisfiesVersion(ranges, version)) {
      incompatiblePackages[pkg] = version;
    }
  }

  if (Object.keys(incompatiblePackages).length > 0) {
    return { success: false, incompatiblePackages };
  }

  freezeBuiltins();

  return { success: true };
}

function freezeBuiltins() {
  // Taken from https://github.com/snyk-labs/nopp/blob/main/index.js
  [
    Object,
    Object.prototype,
    Function,
    // We don't freeze the prototype of Function, as it's used by mysql2
    // We'll investigate later and see how this can be abused
    // Function.prototype,
    Array,
    Array.prototype,
    String,
    String.prototype,
    Number,
    Number.prototype,
    Boolean,
    Boolean.prototype,
  ].forEach(Object.freeze);
}
