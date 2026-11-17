import * as mod from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { isEsmUnitTest } from "../../../helpers/isEsmUnitTest";
import { wrap } from "../../../helpers/wrap";
import { FileSystem } from "../../../sinks/FileSystem";
import { type Context, runWithContext } from "../../Context";
import { registerNodeHooks } from "./index";

const unsafePath = "/etc/passwd";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: { file: { matches: unsafePath } },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test(
  "builtin modules are patched when import-in-the-middle is active",
  {
    skip:
      !("registerHooks" in mod) || !isEsmUnitTest()
        ? "Only relevant for ESM apps (run via test:esm)"
        : false,
  },
  async (t) => {
    const agent = createTestAgent({ block: true });
    const failedToWrap: string[] = [];
    wrap(agent, "onFailedToWrapModule", function onFailedToWrapModule() {
      return function onFailedToWrapModule(path: string) {
        failedToWrap.push(path);
      };
    });

    agent.start([new FileSystem()]);
    registerNodeHooks();

    mod.register(
      "import-in-the-middle/hook.mjs",
      pathToFileURL(`${__dirname}/`),
      { data: { include: ["fs", "path"] } }
    );

    const { Hook } = require("import-in-the-middle");

    const hooked: string[] = [];
    let otherInstrumentationCalls = 0;
    new Hook(["fs", "path"], (exports: any, name: string) => {
      hooked.push(name);

      if (name === "fs") {
        const original = exports.readFileSync;
        exports.readFileSync = function readFileSync(
          this: unknown,
          ...args: unknown[]
        ) {
          otherInstrumentationCalls++;
          return original.apply(this, args);
        };
      }
    });

    const fsModule = await import("fs");
    const pathModule = await import("path");

    t.same(failedToWrap, [], "builtins were instrumented without errors");
    t.same(hooked.sort(), ["fs", "path"], "import-in-the-middle hook ran");

    runWithContext(context, () => {
      let error: unknown;
      try {
        fsModule.readFileSync(unsafePath);
      } catch (e) {
        error = e;
      }
      t.match(String(error), /Zen has blocked a path traversal attack/);
    });
    t.equal(otherInstrumentationCalls, 1, "other instrumentation was executed");

    t.equal(typeof fsModule.readFileSync, "function");
    t.equal(typeof fsModule.promises.readFile, "function");
    t.equal(typeof pathModule.join, "function");
    t.equal(pathModule.join("a", "b"), join("a", "b"));
  }
);
