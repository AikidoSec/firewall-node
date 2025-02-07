import * as t from "tap";
import { isVersionGreaterOrEqual } from "./isVersionGreaterOrEqual";

t.test("invalid versions", async (t) => {
  t.same(isVersionGreaterOrEqual("1.0.0", "1.0"), false);
  t.same(isVersionGreaterOrEqual("1.0", "1.0.0"), false);
  t.same(isVersionGreaterOrEqual("1.0.0", " "), false);
  t.same(isVersionGreaterOrEqual(" ", "1.0.0"), false);
  t.same(isVersionGreaterOrEqual("a.b.c", "1.0.0"), false);
  t.same(isVersionGreaterOrEqual("1.0.0", "a.b.c"), false);
});

t.test("version is bigger or equal", async (t) => {
  t.same(isVersionGreaterOrEqual("1.0.0", "1.0.0"), true);
  t.same(isVersionGreaterOrEqual("1.0.0", "1.0.1"), true);
  t.same(isVersionGreaterOrEqual("1.0.0", "1.1.0"), true);
  t.same(isVersionGreaterOrEqual("1.0.0", "2.0.0"), true);
  t.same(isVersionGreaterOrEqual("1.0.0", "2.0.1"), true);
  t.same(isVersionGreaterOrEqual("1.0.0", "2.1.0"), true);
  t.same(isVersionGreaterOrEqual("1.0.0", "2.1.1"), true);
  t.same(isVersionGreaterOrEqual("1.1.0", "1.1.0"), true);
  t.same(isVersionGreaterOrEqual("1.1.0", "1.1.1"), true);
  t.same(isVersionGreaterOrEqual("1.1.0", "2.0.0"), true);
});

t.test("version is smaller", async (t) => {
  t.same(isVersionGreaterOrEqual("1.0.0", "0.0.0"), false);
  t.same(isVersionGreaterOrEqual("1.0.0", "0.0.1"), false);
  t.same(isVersionGreaterOrEqual("1.0.0", "0.1.0"), false);
  t.same(isVersionGreaterOrEqual("1.0.0", "0.1.1"), false);
  t.same(isVersionGreaterOrEqual("1.1.0", "1.0.0"), false);
});
