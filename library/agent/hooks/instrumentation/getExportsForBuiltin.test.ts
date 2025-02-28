import * as t from "tap";
import { getExportsForBuiltin } from "./getExportsForBuiltin";

t.test("getExportsForBuiltin works", async (t) => {
  t.match(
    getExportsForBuiltin("fs"),
    new Set([
      "default",
      "appendFile",
      "appendFileSync",
      "access",
      "accessSync",
      "chown",
      "chownSync",
      "chmod",
      "chmodSync",
      "close",
      "closeSync",
      "copyFile",
      "copyFileSync",
      "writeFile",
      "writeFileSync",
      "constants",
      "promises",
      "F_OK",
      // ...
    ])
  );

  t.match(
    getExportsForBuiltin("net"),
    new Set([
      "default",
      "createServer",
      "createConnection",
      "isIP",
      // ...
    ])
  );
});
