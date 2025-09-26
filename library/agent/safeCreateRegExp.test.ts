import * as t from "tap";
import { safeCreateRegExp } from "./safeCreateRegExp";

t.test("safeCreateRegExp returns RegExp for valid pattern", async (t) => {
  const regex = safeCreateRegExp("abc", "i");
  t.ok(regex instanceof RegExp);
  t.ok(regex!.test("Abc"));
});

t.test("safeCreateRegExp returns undefined for invalid pattern", async (t) => {
  const regex = safeCreateRegExp("[", "i");
  t.equal(regex, undefined);
});

t.test("safeCreateRegExp returns undefined for invalid flags", async (t) => {
  const regex = safeCreateRegExp("abc", "invalidflag");
  t.equal(regex, undefined);
});

t.test("safeCreateRegExp works with empty pattern", async (t) => {
  const regex = safeCreateRegExp("", "");
  t.ok(regex instanceof RegExp);
  t.ok(regex!.test(""));
});
