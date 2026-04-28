import { onModuleLoad } from "./loadHook";
import * as mod from "node:module";
import type { RegisterHookFunction } from "./types";
import { patchProcessGetBuiltinModule } from "./processGetBuiltin";
import { checkHooks } from "./checkHooks";

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

  patchProcessGetBuiltinModule();

  // Run a self-check that prints a warning on failure
  checkHooks();
}
