import * as t from "tap";
import { generateBuildinShim } from "./builtinShim";

t.test("generate fs/promises shim", async (t) => {
  // Todo update
  const shim = generateBuildinShim("fs/promises", "fs/promises", [
    {
      name: "readFile",
      inspectArgs: true,
      modifyArgs: false,
      modifyReturnValue: false,
    },
  ]);
  if (!shim) {
    t.fail("shim is undefined");
    return;
  }

  t.match(
    shim.replace(/\s+/g, " "),
    `const orig = process.getBuiltinModule("fs/promises"); 
const { __instrumentInspectArgs } = require('@aikidosec/firewall/instrument/internals');

orig.readFile = function() {
    __instrumentInspectArgs("fs/promises.readFile", arguments);                
    return orig.readFile(...arguments);                                              
};

exports = orig;
`.replace(/\s+/g, " ")
  );

  const modifiedShim = shim.replace(
    "@aikidosec/firewall/instrument/internals",
    "./injectedFunctions"
  );

  let modifiedExports = eval(modifiedShim);
  console.log(modifiedExports);
});
