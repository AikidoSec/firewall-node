import { getMajorNodeVersion } from "./getNodeVersion";

function parseAndCatchError(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function canParse(url: string): URL | undefined {
  if (URL.canParse(url)) {
    return new URL(url);
  }

  return undefined;
}

// URL.canParse(...) can give wrong results on Node.js < 24, so we only use it from 24+.
export const tryParseURL: (url: string) => URL | undefined =
  typeof URL.canParse === "function" && getMajorNodeVersion() >= 24
    ? canParse
    : parseAndCatchError;
