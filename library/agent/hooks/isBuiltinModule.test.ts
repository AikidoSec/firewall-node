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
  if (getMajorNodeVersion() >= 24) {
    t.equal(isBuiltinModule("node:sqlite"), true);
  }
});
