/**
 * Detects if the current process is running on a musl-based system (e.g. Alpine Linux).
 * Based on the approach from the detect-libc package.
 */
export function isMusl(): boolean {
  if (process.platform !== "linux") {
    return false;
  }

  try {
    const report = process.report?.getReport() as Record<string, unknown>;
    if (!report) {
      return false;
    }

    const header = report.header as Record<string, unknown> | undefined;
    if (header && typeof header.glibcVersionRuntime === "string") {
      return false;
    }

    const sharedObjects = report.sharedObjects as string[] | undefined;
    if (Array.isArray(sharedObjects)) {
      return sharedObjects.some(
        (so) => so.includes("libc.musl-") || so.includes("ld-musl-")
      );
    }

    return false;
  } catch {
    return false;
  }
}
