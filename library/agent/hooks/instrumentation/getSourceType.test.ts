import * as t from "tap";
import { getSourceType } from "./getSourceType";

t.test("getSourceType works", async (t) => {
  t.same(getSourceType("file.js", "commonjs"), 2);
  t.same(getSourceType("file.js", "module"), 3);
  t.same(getSourceType("file.js", "unambiguous"), 0);

  t.same(getSourceType("file.mjs", "commonjs"), 3);
  t.same(getSourceType("file.mjs", "module"), 3);
  t.same(getSourceType("file.mjs", "unambiguous"), 3);

  t.same(getSourceType("file.ts", "commonjs"), 1);
  t.same(getSourceType("file.ts", "module"), 1);
  t.same(getSourceType("file.ts", "unambiguous"), 1);

  t.same(getSourceType("file.tsx", "commonjs"), 4);
  t.same(getSourceType("file.tsx", "module"), 4);
  t.same(getSourceType("file.tsx", "unambiguous"), 4);

  t.same(getSourceType("file.cjs", "commonjs"), 2);
  t.same(getSourceType("file.cjs", "module"), 2);
  t.same(getSourceType("file.cjs", "unambiguous"), 2);

  t.same(getSourceType("/test/file.ts", "commonjs"), 1);
  t.same(getSourceType("/test/file.ts", "module"), 1);
  t.same(getSourceType("/test/file.ts", "unambiguous"), 1);

  t.throws(() => getSourceType("file.unknown", "commonjs"));
});
