import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { applyHooks } from "../../applyHooks";
import { Hooks } from "../Hooks";
import * as mod from "node:module";
import { registerNodeHooks } from "./index";
import { Agent } from "../../Agent";
import { onModuleLoad } from "./loadHook";
import { envToBool } from "../../../helpers/envToBool";
import { isEsmUnitTest } from "../../../helpers/isEsmUnitTest";

const isESMTest = isEsmUnitTest();

t.test(
  "it throws an error if Node.js version is not supported",
  {
    skip:
      "registerHooks" in mod ? "Only tested on older Node.js versions" : false,
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

    const cjsPkgInspectArgs: any[] = [];
    const esmPkgInspectArgs: any[] = [];

    const hooks = new Hooks();

    const pkg = hooks.addPackage("hono");
    pkg
      .withVersion("^4.0.0")
      .addFileInstrumentation({
        path: "dist/cjs/hono-base.js",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "addRoute",
            operationKind: undefined,
            inspectArgs: (args, agent, subject) => {
              cjsPkgInspectArgs.push(args);

              t.ok(agent instanceof Agent);
              if (
                typeof subject !== "object" ||
                !subject ||
                !("constructor" in subject)
              ) {
                t.fail("subject should have a constructor property");
                return;
              }

              t.same(subject.constructor.name, "Hono");

              if (!("get" in subject) || typeof subject.get !== "function") {
                t.fail("subject should have a get method");
                return;
              }
            },
          },
        ],
      })
      .addFileInstrumentation({
        path: "dist/hono-base.js",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "addRoute",
            operationKind: undefined,
            inspectArgs: (args, agent, subject) => {
              esmPkgInspectArgs.push(args);

              t.ok(agent instanceof Agent);
              if (
                typeof subject !== "object" ||
                !subject ||
                !("constructor" in subject)
              ) {
                t.fail("subject should have a constructor property");
                return;
              }

              t.same(subject.constructor.name, "Hono");

              if (!("get" in subject) || typeof subject.get !== "function") {
                t.fail("subject should have a get method");
                return;
              }
            },
          },
        ],
      });

    pkg.withVersion("^4.0.0").onRequire((exports, pkgInfo) => {
      // This should not be called
      t.fail("onRequire should not be called (old hook system)");
    });

    let httpOnRequireCount = 0;

    hooks.addBuiltinModule("http").onRequire((exports, pkgInfo) => {
      exports.get = 42;
      ++httpOnRequireCount;
    });

    hooks
      .addPackage("fastify")
      .withVersion("^0.0.0")
      .addFileInstrumentation({
        path: "foo.js",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "bar",
            operationKind: undefined,
            inspectArgs: (args) => {
              t.fail("inspectArgs should not be called");
            },
          },
        ],
      });

    applyHooks(hooks, true);

    // Disable unit test path rewrite to throw error
    process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "false";

    if (!isESMTest) {
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
    }

    // Try to register hooks again to test if it still works
    registerNodeHooks();

    if (!isESMTest) {
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
    }

    process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "true";

    t.same(httpOnRequireCount, 0);

    const honoRequire = require("hono") as typeof import("hono");

    t.same(cjsPkgInspectArgs.length, 0);
    t.same(esmPkgInspectArgs.length, 0);

    const honoRequireInstance = new honoRequire.Hono();
    honoRequireInstance.get("/test", async (c) => {
      return c.text("Hello, World!");
    });

    if (isESMTest) {
      t.same(cjsPkgInspectArgs.length, 0);
      t.same(esmPkgInspectArgs.length, 1);
      t.same(esmPkgInspectArgs[0][0], "get");
      t.same(esmPkgInspectArgs[0][1], "/test");
      t.same(typeof esmPkgInspectArgs[0][2], "function");
    } else {
      t.same(esmPkgInspectArgs.length, 0);
      t.same(cjsPkgInspectArgs.length, 1);
      t.same(cjsPkgInspectArgs[0][0], "get");
      t.same(cjsPkgInspectArgs[0][1], "/test");
      t.same(typeof cjsPkgInspectArgs[0][2], "function");
    }

    const honoImport = await import("hono");
    const honoImportInstance = new honoImport.Hono();
    honoImportInstance.post("/test2", async (c) => {
      return c.text("Hello, World!");
    });

    if (isESMTest) {
      t.same(cjsPkgInspectArgs.length, 0);
      t.same(esmPkgInspectArgs.length, 2);
      t.same(esmPkgInspectArgs[1][0], "post");
      t.same(esmPkgInspectArgs[1][1], "/test2");
      t.same(typeof esmPkgInspectArgs[1][2], "function");
    } else {
      t.same(esmPkgInspectArgs.length, 0);
      t.same(cjsPkgInspectArgs.length, 2);
      t.same(cjsPkgInspectArgs[1][0], "post");
      t.same(cjsPkgInspectArgs[1][1], "/test2");
      t.same(typeof cjsPkgInspectArgs[1][2], "function");
    }

    t.same(httpOnRequireCount, 0);
    const http = require("node:http");
    t.equal(http.get, 42);
    t.equal(typeof http.createServer, "function");
    t.equal(typeof http.Server, "function");
    t.same(httpOnRequireCount, 1);

    // Not patched twice
    require("node:http");
    t.same(httpOnRequireCount, 1);

    // Require unpatched module
    const assert = require("assert") as typeof import("assert");
    t.equal(typeof assert.ok, "function");

    if (!isESMTest) {
      // Require json file
      const packageJson = require("../../../package.json");
      t.same(packageJson.name, "@aikidosec/firewall");

      // Load user code
      const userCode = await import("./getSourceType");
      t.same(typeof userCode.getSourceType, "function");
    }

    // Should not patch package
    const express = require("express") as typeof import("express");
    t.equal(typeof express, isESMTest ? "object" : "function");

    // Package with non-matching version
    const fastify = require("fastify") as typeof import("fastify");
    t.equal(typeof fastify, isESMTest ? "object" : "function");
  }
);

t.test("call with invalid args", async (t) => {
  // @ts-expect-error Invalid args
  t.same(onModuleLoad("test", undefined, "test"), "test");
  // @ts-expect-error Invalid args
  t.same(onModuleLoad("test", undefined, undefined), undefined);
});
