import { getMajorNodeVersion } from "./getNodeVersion";

type ParseFunction = (url: string) => URL | undefined;

let tryParseURL: ParseFunction;

tryParseURL = parseAndCatchError;

function parseAndCatchError(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function canParse(url: string): URL | undefined {
  if (URL.canParse(url)) {
    // URL.canParse(...) can return true for invalid URLs, so we still need to catch constructor errors.
    return parseAndCatchError(url);
  }

  return undefined;
}

// URL.canParse(...) is a lot faster than using the constructor and catching the error
// URL.canParse(...) can give wrong results on Node.js < 24, so we only use it from 24+.
if (typeof URL.canParse === "function" && getMajorNodeVersion() >= 24) {
  tryParseURL = canParse;
}

export { tryParseURL };
