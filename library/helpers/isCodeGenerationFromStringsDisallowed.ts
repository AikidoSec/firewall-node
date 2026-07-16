// Returns true if Node was started with --disallow-code-generation-from-strings
// (or via NODE_OPTIONS). With that flag, V8 blocks every eval and new Function()
// call by itself.
//
// We test this by actually trying to build a function. If V8 blocks code generation,
// it throws an EvalError. Checking the real behavior is more reliable than reading
// process flags, since it catches every way the flag can be set.
//
// Call this before registering our own code generation callback. Once our callback is
// set it allows code generation when there is no request, which would hide the flag.
export function isCodeGenerationFromStringsDisallowed(): boolean {
  try {
    // oxlint-disable-next-line no-implied-eval
    new Function("");
    return false;
  } catch (error) {
    return error instanceof EvalError;
  }
}
