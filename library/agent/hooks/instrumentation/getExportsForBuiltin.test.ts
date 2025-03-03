import * as t from "tap";
import { getExportsForBuiltin } from "./getExportsForBuiltin";
import { getMajorNodeVersion } from "../../../helpers/getNodeVersion";

t.test(
  "getExportsForBuiltin works",
  {
    skip: getMajorNodeVersion() < 20 ? "Node.js 20+ required" : false,
  },
  async (t) => {
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
  }
);
