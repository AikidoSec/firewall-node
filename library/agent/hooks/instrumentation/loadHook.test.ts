import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { wrapNewInstance } from "../wrapNewInstance";
import { wrapExport } from "../wrapExport";
import { applyHooks } from "../../applyHooks";
import { Hooks } from "../Hooks";
import { getMajorNodeVersion } from "../../../helpers/getNodeVersion";

t.test(
  "it works",
  {
    skip: getMajorNodeVersion() < 20 ? "Node.js 20+ required" : false,
  },
  async (t) => {
    createTestAgent();

    const esmPkgInspectArgs: any[] = [];
    const cjsPkgInspectArgs: any[] = [];

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
      const newExports = Object.create(exports);

      wrapNewInstance(newExports, "Hono", pkgInfo, (instance) => {
        wrapExport(instance, "get", pkgInfo, {
          inspectArgs: (args, agent) => {
            cjsPkgInspectArgs.push(args);
          },
        });
      });

      return newExports;
    });

    hooks.addBuiltinModule("http");

    applyHooks(hooks, true);

    try {
      // Todo find way to test with throwing error

      const honoCJS = require("hono") as typeof import("hono");
    } catch (error) {
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          /Cannot find module '@aikidosec\/firewall\/instrument\/internals'/
        );
      }
    }

    t.same(esmPkgInspectArgs, []);
    t.same(cjsPkgInspectArgs, []);

    /*const honoESMInstance = new honoESM.Hono();
    honoESMInstance.get("/test", async (c) => {
        return c.text("Hello, World!");
    });

    const honoCJSInstance = new honoCJS.Hono();
    honoCJSInstance.get("/test2", async (c) => {
      return c.text("Hello, World 2!");
    });

    t.same(esmPkgInspectArgs, [[{ path: "/test" }]]);
    t.same(cjsPkgInspectArgs, [[{ path: "/test2" }]]);*/
  }
);
