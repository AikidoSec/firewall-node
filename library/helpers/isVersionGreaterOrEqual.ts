export function isVersionGreaterOrEqual(
  reference: string,
  current: string
): boolean {
  try {
    const [major1, minor1, patch1] = parseVersion(current);
    const [major2, minor2, patch2] = parseVersion(reference);

    if (major1 > major2) {
      return true;
    }

    if (major1 < major2) {
      return false;
    }

    if (minor1 > minor2) {
      return true;
    }

    if (minor1 < minor2) {
      return false;
    }

    return patch1 >= patch2;
  } catch (e) {
    return false;
  }
}

function parseVersion(version: string): number[] {
  const parts = version.split(".").map((str) => parseInt(str, 10));

  if (parts.length !== 3 || parts.some((part) => isNaN(part))) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return parts;
}
