/**
 * Checks at runtime if the Node.js application is using ESM.
 */
export function isESM() {
  // require.main represents the entry script loaded when the Node.js process launched, or undefined if the entry point of the program is not a CommonJS module.
  // It can only be used in CommonJS modules, but our library is currently distributed as CommonJS, so this check is safe to use.
  return require?.main === undefined;
}
