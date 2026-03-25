/* oxlint-disable func-names */

/**
 * Checks if a function is a generator function.
 * They are deprecated in koa v2 and are already removed in the main branch (will be completely removed in v3).
 */
export function isDeprecatedGenerator(fn: Function): boolean {
  const GeneratorFunction = function* () {}.constructor;

  if (fn instanceof GeneratorFunction) {
    return true;
  }

  const AsyncGeneratorFunction = async function* () {}.constructor;
  if (fn instanceof AsyncGeneratorFunction) {
    return true;
  }

  return false;
}
