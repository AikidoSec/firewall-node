import { onModuleLoad } from "./loadHook";
import * as module from "node:module";
import type { RegisterHookFunction } from "./types";
import { Hooks } from "../Hooks";

export function registerNodeHooks(hooks: Hooks) {
  if (
    !("registerHooks" in module) ||
    typeof module.registerHooks !== "function"
  ) {
    throw new Error("This Node.js version is not supported");
  }

  // Hook into the ESM & CJS module loading process
  // Types are required because official Node.js typings are not up-to-date
  (module.registerHooks as RegisterHookFunction)({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      return onModuleLoad(url, context, result);
    },
  });
}
