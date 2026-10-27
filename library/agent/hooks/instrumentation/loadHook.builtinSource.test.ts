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
import { onModuleLoad } from "./loadHook";

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
  "builtin modules are still patched with import-in-the-middle",
  {
    skip:
      !("registerHooks" in mod) || !isEsmUnitTest()
        ? "Only relevant for ESM apps"
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

    // Registered first, so import-in-the-middle's nextLoad receives the fake source
    mod.register(
      pathToFileURL(join(__dirname, "fixtures/builtinSourceLoader.mjs")),
      pathToFileURL(`${__dirname}/`)
    );
    mod.register(
      "import-in-the-middle/hook.mjs",
      pathToFileURL(`${__dirname}/`),
      { data: { include: ["fs", "path"] } }
    );

    const { Hook } = require("import-in-the-middle");

    const hooked: string[] = [];
    new Hook(["fs", "path"], (_exports: unknown, name: string) => {
      hooked.push(name);
    });

    await import("fs");
    await import("path");

    t.same(failedToWrap, [], "builtins were instrumented without errors");
    t.same(hooked.sort(), ["fs", "path"], "import-in-the-middle hook ran");

    const fs = process.getBuiltinModule("fs");
    runWithContext(context, () => {
      let error: unknown;
      try {
        fs.readFileSync(unsafePath);
      } catch (e) {
        error = e;
      }
      t.match(String(error), /Zen has blocked a path traversal attack/);
    });

    const previousLoadResult = {
      format: "builtin" as const,
      shortCircuit: undefined,
      source: "export const fake = true;",
    };
    const result = onModuleLoad(
      "node:fs",
      undefined as any,
      previousLoadResult
    );
    t.equal(result, previousLoadResult, "load result is returned untouched");
  }
);
