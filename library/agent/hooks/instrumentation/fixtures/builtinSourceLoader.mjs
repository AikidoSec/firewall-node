// Simulates a composed loader that supplies a source for builtin modules.
// Node.js ignores the source of builtins, but loaders like import-in-the-middle might not
// https://github.com/nodejs/import-in-the-middle/pull/305
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);

  if (result.format === "builtin" && (url === "node:fs" || url === "fs")) {
    return { ...result, source: "export const fake = true;" };
  }

  return result;
}
