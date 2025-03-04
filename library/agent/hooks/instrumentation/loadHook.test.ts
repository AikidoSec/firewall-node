import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { applyHooks } from "../../applyHooks";
import { Hooks } from "../Hooks";
import * as mod from "node:module";
import { registerNodeHooks } from ".";

t.test(
  "it throws an error if Node.js version is not supported",
  {
    skip:
      "registerHooks" in mod ? "Only test on older Node.js versions" : false,
  },
  async (t) => {
    createTestAgent();
    const error = t.throws(() => applyHooks(new Hooks(), true));
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(error.message, /This Node.js version is not supported/);
    }
  }
);

t.test(
  "it works",
  {
    skip: !("registerHooks" in mod) ? "Recent Node.js version required" : false,
  },
  async (t) => {
    createTestAgent();

    const esmPkgInspectArgs: any[] = [];

    const hooks = new Hooks();

    const pkg = hooks.addPackage("hono");
    pkg.withVersion("^4.0.0").addFileInstrumentation({
      path: "dist/cjs/hono-base.js",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "addRoute",
          inspectArgs: (args) => {
            esmPkgInspectArgs.push(args);
          },
        },
      ],
    });

    pkg.withVersion("^4.0.0").onRequire((exports, pkgInfo) => {
      // This should not be called
      t.fail("onRequire should not be called (old hook system)");
    });

    hooks.addBuiltinModule("http").onRequire((exports, pkgInfo) => {
      exports.test = 42;
    });

    applyHooks(hooks, true);

    try {
      require("hono") as typeof import("hono");
      t.fail("require should fail");
    } catch (error) {
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          /Cannot find module '@aikidosec\/firewall\/instrument\/internals'/
        );
      }
    }

    // Try to register hooks again to test if it still works
    registerNodeHooks();

    try {
      await import("hono");
      t.fail("import should not work");
    } catch (error) {
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          /Cannot find module '@aikidosec\/firewall\/instrument\/internals'/
        );
      }
    }

    process.env.AIKIDO_UNIT_TEST = "true";

    const honoRequire = require("hono") as typeof import("hono");

    t.same(esmPkgInspectArgs.length, 0);

    const honoRequireInstance = new honoRequire.Hono();
    honoRequireInstance.get("/test", async (c) => {
      return c.text("Hello, World!");
    });

    t.same(esmPkgInspectArgs.length, 1);
    t.same(esmPkgInspectArgs[0][0], "get");
    t.same(esmPkgInspectArgs[0][1], "/test");
    t.same(typeof esmPkgInspectArgs[0][2], "function");

    const honoImport = await import("hono");
    const honoImportInstance = new honoImport.Hono();
    honoImportInstance.post("/test2", async (c) => {
      return c.text("Hello, World!");
    });

    t.same(esmPkgInspectArgs.length, 2);
    t.same(esmPkgInspectArgs[1][0], "post");
    t.same(esmPkgInspectArgs[1][1], "/test2");
    t.same(typeof esmPkgInspectArgs[1][2], "function");

    const http = require("node:http");
    t.equal(http.test, 42);
    t.equal(typeof http.createServer, "function");
    t.equal(typeof http.Server, "function");

    // Require unpatched module
    const assert = require("assert") as typeof import("assert");
    t.equal(typeof assert, "function");

    process.env.AIKIDO_UNIT_TEST = "false";
  }
);
