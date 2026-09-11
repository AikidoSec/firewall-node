// ESM wrapper for injectedFunctions.ts for unit tests with AIKIDO_TEST_NEW_INSTRUMENTATION=true
// and the instrumented file is an ES module (.mjs).
// Static named imports from a CJS .ts file do not work in ESM context when ts-node is used

import { createRequire } from "module";
import { join } from "path";

const require = createRequire(import.meta.url);

const {
  __instrumentInspectArgs,
  __instrumentModifyArgs,
  __instrumentModifyReturnValue,
  __instrumentAccessLocalVariables,
} = require(join(import.meta.dirname, "injectedFunctions.ts"));

export {
  __instrumentInspectArgs,
  __instrumentModifyArgs,
  __instrumentModifyReturnValue,
  __instrumentAccessLocalVariables,
};
