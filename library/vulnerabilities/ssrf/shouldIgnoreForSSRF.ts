import { Source } from "../../agent/Source";

/**
 * Ignore the Host, Origin, and Referer headers when checking for SSRF to prevent false positives
 */
export function shouldIgnoreForSSRF({
  source,
  paths,
}: {
  source: Source;
  paths: string[];
}): boolean {
  if (source !== "headers") {
    return false;
  }

  const headersToIgnore = [".host", ".origin", ".referer"];

  const ignoredPathsCount = paths.filter((path) =>
    headersToIgnore.includes(path)
  ).length;

  return ignoredPathsCount === paths.length;
}
