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

// URL.canParse(...) is a lot faster than using the constructor and catching the error
// Added in Node.js: v19.9.0, v18.17.0
if (typeof URL.canParse === "function") {
  tryParseURL = canParse;

  function canParse(url: string): URL | undefined {
    if (URL.canParse(url)) {
      return new URL(url);
    }

    return undefined;
  }
}

export { tryParseURL };
