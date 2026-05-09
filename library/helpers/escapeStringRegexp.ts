let funcToExport: (string: string) => string;

/**
 * Escape characters with special meaning either inside or outside character sets.
 *
 * Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
 *
 * Taken from https://github.com/sindresorhus/escape-string-regexp/
 */
function escapeStringRegexpFallback(string: string) {
  return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}

// Use native implementation if available (Node.js 24+)
// A benchmark showed that it is up to 50% faster than the polyfill
// @ts-expect-error Outdated Node.js types
if (typeof RegExp?.escape === "function") {
  // @ts-expect-error Outdated Node.js types
  funcToExport = RegExp.escape;
} else {
  funcToExport = escapeStringRegexpFallback;
}

export { funcToExport as escapeStringRegexp };
