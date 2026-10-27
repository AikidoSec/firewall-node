import * as mod from "node:module";
import { pathToFileURL } from "node:url";
import * as t from "tap";
import { createTestAgent } from "../helpers/createTestAgent";
import { applyHooks } from "../agent/applyHooks";
import { Hooks } from "../agent/hooks/Hooks";
import { Fastify } from "./Fastify";
import { registerNodeHooks } from "../agent/hooks/instrumentation/index";
import { Token } from "../agent/api/Token";
import { wrap } from "../helpers/wrap";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";

t.test(
  "default and named imports of fastify work with import-in-the-middle",
  {
    skip:
      !("registerHooks" in mod) || !isEsmUnitTest()
        ? "Only relevant for ESM apps (run via test:esm)"
        : false,
  },
  async (t) => {
    const agent = createTestAgent({ token: new Token("token") });
    const failedToWrap: string[] = [];
    wrap(agent, "onFailedToWrapModule", function onFailedToWrapModule() {
      return function onFailedToWrapModule(path: string) {
        failedToWrap.push(path);
      };
    });

    const hooks = new Hooks();
    new Fastify().wrap(hooks);
    applyHooks(hooks, true);
    registerNodeHooks();

    mod.register(
      "import-in-the-middle/hook.mjs",
      pathToFileURL(`${__dirname}/`)
    );

    const { Hook } = require("import-in-the-middle");

    let hookCalls = 0;
    new Hook(["fastify"], (exports: Record<string, unknown>) => {
      hookCalls++;
      const original = exports.default;
      if (typeof original !== "function") {
        return;
      }
      const patched = function (this: unknown, ...args: unknown[]) {
        return original.apply(this, args);
      };
      Object.assign(patched, original);
      exports.default = patched;
      if ("fastify" in exports) {
        exports.fastify = patched;
      }
    });

    const fastifyModule = await import("fastify");

    t.same(failedToWrap, [], "fastify was instrumented without errors");
    t.equal(hookCalls, 1, "import-in-the-middle hook was called");
    t.equal(typeof fastifyModule.default, "function");
    t.equal(typeof fastifyModule.fastify, "function");

    const app = (
      fastifyModule.default as () => { close: () => Promise<void> }
    )();
    t.ok(app);
    await app.close();
  }
);
