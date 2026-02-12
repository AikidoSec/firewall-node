/**
 * Checks at runtime if the Node.js application is using ESM.
 */
export function isESM() {
  // This should normally not happen because our library is currently distributed as CommonJS
  // But to be safe against strange edge cases and future changes, we check if require is undefined, which would indicate we're in ESM mode.
  if (typeof require === "undefined") {
    // If require is undefined, we're definitely in ESM mode
    return true;
  }

  // require.main represents the entry script loaded when the Node.js process launched, or undefined if the entry point of the program is not a CommonJS module.
  // It can only be used in CommonJS modules, but our library is currently distributed as CommonJS, so this check is safe to use.
  return require?.main === undefined;
}
