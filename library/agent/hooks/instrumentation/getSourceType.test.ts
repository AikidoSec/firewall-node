import * as t from "tap";
import { getSourceType } from "./getSourceType";

t.test("getSourceType works", async (t) => {
  t.same(getSourceType("file.js", true), 3);
  t.same(getSourceType("file.js", false), 2);
  t.same(getSourceType("file.mjs", false), 3);
  t.same(getSourceType("file.ts", false), 1);
  t.same(getSourceType("file.tsx", false), 4);
  t.same(getSourceType("file.cjs", false), 2);
  t.same(getSourceType("file.cjs", true), 2);
  t.same(getSourceType("/test/file.ts", true), 1);
  t.throws(() => getSourceType("file.unknown", false));
});
