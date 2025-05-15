import { onModuleLoad } from "./loadHook";
import * as mod from "node:module";
import type { RegisterHookFunction } from "./types";
import { patchProcessGetBuiltinModule } from "./processGetBuiltin";
import { join } from "node:path";
import { envToBool } from "../../../helpers/envToBool";

let hooksRegistered = false;

export function registerNodeHooks() {
  if (!("registerHooks" in mod) || typeof mod.registerHooks !== "function") {
    throw new Error("This Node.js version is not supported");
  }

  // Do not register hooks multiple times
  if (hooksRegistered) {
    return;
  }
  hooksRegistered = true;

  // Hook into the ESM & CJS module loading process
  // Types are required because official Node.js typings are not up-to-date
  (mod.registerHooks as RegisterHookFunction)({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      return onModuleLoad(url, context, result);
    },
  });

  // DEV rewrite for unit tests
  if (envToBool(process.env.AIKIDO_TEST_NEW_INSTRUMENTATION)) {
    (mod.registerHooks as RegisterHookFunction)({
      resolve(specifier, context, nextResolve) {
        if (specifier === "@aikidosec/firewall/instrument/internals") {
          specifier = join(__dirname, "injectedFunctions.ts");
        }

        return nextResolve(specifier, context);
      },
    });
  }

  patchProcessGetBuiltinModule();
}
