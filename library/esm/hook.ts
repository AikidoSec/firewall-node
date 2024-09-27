// @ts-nocheck Todo

// https://nodejs.org/api/module.html#hooks
// The hooks thread may be terminated by the main thread at any time, so do not depend on asynchronous operations (like console.log) to complete.

export async function initialize({ port }) {
  // Receives data from `register`.
  console.log("initialize");
}

export async function resolve(specifier, context, nextResolve) {
  console.log("--- resolve ---");
  console.log(specifier, context, nextResolve);
  return nextResolve(specifier);
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  console.log("--- load ---");
  console.log(url, context, nextLoad);
  console.log(result);
  console.log("\n");

  return result;
}
