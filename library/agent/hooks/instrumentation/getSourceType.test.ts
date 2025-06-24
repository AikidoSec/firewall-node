import * as t from "tap";
import { getSourceType } from "./getSourceType";

t.test("getSourceType works", async (t) => {
  t.same(getSourceType("file.js", "commonjs"), "cjs");
  t.same(getSourceType("file.js", "module"), "mjs");
  t.same(getSourceType("file.js", "unambiguous"), "unambiguous");

  t.same(getSourceType("file.mjs", "commonjs"), "mjs");
  t.same(getSourceType("file.mjs", "module"), "mjs");
  t.same(getSourceType("file.mjs", "unambiguous"), "mjs");

  t.same(getSourceType("file.ts", "commonjs"), "ts");
  t.same(getSourceType("file.ts", "module"), "ts");
  t.same(getSourceType("file.ts", "unambiguous"), "ts");

  t.same(getSourceType("file.tsx", "commonjs"), "tsx");
  t.same(getSourceType("file.tsx", "module"), "tsx");
  t.same(getSourceType("file.tsx", "unambiguous"), "tsx");

  t.same(getSourceType("file.jsx", "commonjs"), "jsx");
  t.same(getSourceType("file.jsx", "module"), "jsx");
  t.same(getSourceType("file.jsx", "unambiguous"), "jsx");

  t.same(getSourceType("file.cjs", "commonjs"), "cjs");
  t.same(getSourceType("file.cjs", "module"), "cjs");
  t.same(getSourceType("file.cjs", "unambiguous"), "cjs");

  t.same(getSourceType("/test/file.ts", "commonjs"), "ts");
  t.same(getSourceType("/test/file.ts", "module"), "ts");
  t.same(getSourceType("/test/file.ts", "unambiguous"), "ts");

  t.throws(() => getSourceType("file.unknown", "commonjs"));
});
