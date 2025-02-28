import { onModuleLoad } from "./loadHook";
import * as mod from "node:module";
import type { RegisterHookFunction } from "./types";
import { Hooks } from "../Hooks";

export function registerNodeHooks() {
  if (!("registerHooks" in mod) || typeof mod.registerHooks !== "function") {
    throw new Error("This Node.js version is not supported");
  }

  // Hook into the ESM & CJS module loading process
  // Types are required because official Node.js typings are not up-to-date
  (mod.registerHooks as RegisterHookFunction)({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      return onModuleLoad(url, context, result);
    },
  });
}
