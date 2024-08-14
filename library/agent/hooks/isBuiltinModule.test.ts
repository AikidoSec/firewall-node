import * as t from "tap";
import { isBuiltinModule } from "./isBuiltinModule";

t.test("it works", async (t) => {
  t.equal(isBuiltinModule("fs"), true);
  t.equal(isBuiltinModule("mysql"), false);
  t.equal(isBuiltinModule("http"), true);
  t.equal(isBuiltinModule("node:http"), true);
  t.equal(isBuiltinModule("test"), false);
  // @ts-expect-error Testing the undefined case
  t.equal(isBuiltinModule(undefined), false);
});
