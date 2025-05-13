/**
 * This function checks if a certain version satisfies a version range.
 * @param range A range of versions written in semver
 * @param version A version number
 * @returns True if the version is in range, otherwise returns false
 * @example
 * satisfiesVersion("^1.0.0 || ^2.0.0", "1.0.0") // true
 * @example
 * satisfiesVersion("^1.2.0", "1.2.1") // true
 * @example
 * satisfiesVersion("^1.0.0", "2.0.0") // false
 */
export function satisfiesVersion(range: string, version: string) {
  if (!range || !version) {
    return false;
  }

  const parts = version.split(".");

  if (
    parts.length !== 3 ||
    !parts.every((p) => Number.isInteger(parseInt(p, 10)))
  ) {
    return false;
  }

  // e.g. 1.0.0
  const [major, minor, patch] = parts.map((p) => parseInt(p, 10));

  // e.g. ^4.0.0
  // e.g. ^4.0.0 || ^5.0.0
  // e.g. ^4.0.0 || ^5.0.0 || ^6.0.0
  for (const r of range.split("||").map((r) => r.trim())) {
    if (!r.startsWith("^")) {
      continue;
    }

    const rangeParts = r.slice(1).split(".");

    if (
      rangeParts.length !== 3 ||
      !rangeParts.every((p) => Number.isInteger(parseInt(p, 10)))
    ) {
      continue;
    }

    const [rMajor, rMinor, rPatch] = r
      .slice(1)
      .split(".")
      .map((p) => parseInt(p, 10));

    if (major !== rMajor) {
      continue;
    }

    if (minor < rMinor) {
      continue;
    }

    if (minor === rMinor && patch < rPatch) {
      continue;
    }

    return true;
  }

  return false;
}
