/**
 * Checks if a function is a generator function.
 * They are deprecated in koa v2 and are already removed in the main branch (will be completely removed in v3).
 */
export function isDeprecatedGenerator(fn: Function): boolean {
  if (fn.constructor && typeof fn.constructor.name === "string") {
    if (
      ["GeneratorFunction", "AsyncGeneratorFunction"].includes(
        fn.constructor.name
      )
    ) {
      return true;
    }
  }

  const GeneratorFunction = function* () {
    yield undefined;
  }.constructor;

  if (fn instanceof GeneratorFunction) {
    return true;
  }

  return false;
}
