import * as t from "tap";
import { generateBuildinShim } from "./builtinShim";
import { setBuiltinsToInstrument } from "./instructions";
import { BuiltinModule } from "../BuiltinModule";
import { createTestAgent } from "../../../helpers/createTestAgent";

t.test("Wrap fs/promises", (t) => {
  const agent = createTestAgent();

  const fsPromises = new BuiltinModule("fs/promises");

  fsPromises.onRequire((exports, pkgInfo) => {
    exports.test = 42;
    exports.__aikido_is_awesome = true;
  });

  setBuiltinsToInstrument([fsPromises]);

  const shim = generateBuildinShim("fs/promises", "fs/promises", true);
  if (!shim) {
    t.fail("shim is undefined");
    return;
  }

  t.match(
    shim.replace(/\s+/g, " "),
    `const orig = process.getBuiltinModule("fs/promises");
    const { __wrapBuiltinExports } = require('@aikidosec/firewall/instrument/internals');
    module.exports = __wrapBuiltinExports("fs/promises", orig);
`.replace(/\s+/g, " ")
  );

  const modifiedShim = shim.replace(
    "@aikidosec/firewall/instrument/internals",
    "./injectedFunctions"
  );

  let modifiedExports = eval(modifiedShim);
  t.equal(modifiedExports.test, 42);
  t.equal(modifiedExports.__aikido_is_awesome, true);
  t.ok(typeof modifiedExports.readFile === "function");
  t.ok(typeof modifiedExports.writeFile === "function");

  const shimESM = generateBuildinShim("fs/promises", "fs/promises", false);
  if (!shimESM) {
    t.fail("shim is undefined");
    return;
  }

  t.match(
    shimESM.replace(/\s+/g, " "),
    `const orig = process.getBuiltinModule("fs/promises");
    const { __wrapBuiltinExports } = require('@aikidosec/firewall/instrument/internals');

    const wrapped = __wrapBuiltinExports("fs/promises", orig);

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = wrapped.default;
    exports.access = wrapped.access;
`.replace(/\s+/g, " ")
  );

  t.end();
});
