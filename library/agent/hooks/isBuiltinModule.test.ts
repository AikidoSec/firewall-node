import * as t from "tap";
import { isBuiltinModule } from "./isBuiltinModule";
import { getMajorNodeVersion } from "../../helpers/getNodeVersion";

t.test("it works", async (t) => {
  t.equal(isBuiltinModule("fs"), true);
  t.equal(isBuiltinModule("mysql"), false);
  t.equal(isBuiltinModule("http"), true);
  t.equal(isBuiltinModule("node:http"), true);
  t.equal(isBuiltinModule("test"), false);
  t.equal(isBuiltinModule(""), false);
});

t.test(
  "it works with node:sqlite",
  {
    skip:
      getMajorNodeVersion() < 24
        ? "node:sqlite is not available in older Node.js versions"
        : undefined,
  },
  async (t) => {
    t.equal(isBuiltinModule("node:sqlite"), true);
  }
);
