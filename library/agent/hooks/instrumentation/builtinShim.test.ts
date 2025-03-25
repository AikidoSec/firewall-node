import * as t from "tap";
import { generateBuildinShim } from "./builtinShim";
import { setBuiltinsToInstrument } from "./instructions";
import { BuiltinModule } from "../BuiltinModule";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { getMajorNodeVersion } from "../../../helpers/getNodeVersion";

t.test(
  "Wrap fs/promises",
  {
    skip: getMajorNodeVersion() < 20 ? "Node.js 20+ required" : false,
  },
  (t) => {
    createTestAgent();

    const fsPromises = new BuiltinModule("fs/promises");

    fsPromises.onRequire((exports, pkgInfo) => {
      exports.test = 42;
      exports.__aikidoIsAwesome = true;
    });

    setBuiltinsToInstrument([fsPromises]);

    const shim = generateBuildinShim("fs/promises", "fs/promises", true);
    if (!shim) {
      t.fail("shim is undefined");
      return;
    }

    t.match(
      shim.replace(/\s+/g, " "),
      `const { __getBuiltinModuleWithoutPatching, __wrapBuiltinExports } = require('@aikidosec/firewall/instrument/internals');
      const orig = __getBuiltinModuleWithoutPatching("fs/promises");

    module.exports = __wrapBuiltinExports("fs/promises", orig);
`.replace(/\s+/g, " ")
    );

    const modifiedShim = shim.replace(
      "@aikidosec/firewall/instrument/internals",
      "./injectedFunctions"
    );

    const modifiedExports = eval(modifiedShim);
    t.equal(modifiedExports.test, 42);
    t.equal(modifiedExports.__aikidoIsAwesome, true);
    t.ok(typeof modifiedExports.readFile === "function");
    t.ok(typeof modifiedExports.writeFile === "function");

    const shimESM = generateBuildinShim("fs/promises", "fs/promises", false);
    if (!shimESM) {
      t.fail("shim is undefined");
      return;
    }

    t.match(
      shimESM.replace(/\s+/g, " "),
      `const { __getBuiltinModuleWithoutPatching, __wrapBuiltinExports } = require('@aikidosec/firewall/instrument/internals');
    const orig = __getBuiltinModuleWithoutPatching("fs/promises");

    const wrapped = __wrapBuiltinExports("fs/promises", orig);

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = wrapped.default;
    exports.access = wrapped.access;
`.replace(/\s+/g, " ")
    );

    const nonExistingModuleShim = generateBuildinShim("abc", "abc", false);
    t.equal(nonExistingModuleShim, undefined);

    t.end();
  }
);
