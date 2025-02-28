import * as t from "tap";
import { generateBuildinShim } from "./builtinShim";

t.test("generate fs/promises shim", async (t) => {
  const shim = generateBuildinShim("fs/promises", "fs/promises", [
    {
      name: "readFile",
      inspectArgs: true,
      modifyArgs: false,
      modifyReturnValue: false,
    },
  ]);

  t.match(
    shim?.replace(/\s+/g, " "),
    `const orig = process.getBuiltinModule("fs/promises"); 
const { __instrumentInspectArgs } = require('@aikidosec/firewall/instrument/internals');

exports.readFile = function() {
    __instrumentInspectArgs("fs/promises.readFile", true, arguments);                
    return orig.readFile(...arguments);                                              
};
`.replace(/\s+/g, " ")
  );

  t.match(shim, "exports.rename = orig.rename;");
  t.match(shim, "exports.rmdir = orig.rmdir;");
  t.match(shim, "exports.rm = orig.rm;");
  t.match(shim, "exports.stat = orig.stat;");
  t.match(shim, "exports.symlink = orig.symlink;");
});
