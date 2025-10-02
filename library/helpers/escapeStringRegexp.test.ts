import * as t from "tap";
import { escapeStringRegexp } from "./escapeStringRegexp";

t.test("main", async (t) => {
  t.same(
    escapeStringRegexp("\\ ^ $ * + ? . ( ) | { } [ ]"),
    "\\\\ \\^ \\$ \\* \\+ \\? \\. \\( \\) \\| \\{ \\} \\[ \\]"
  );
});

t.test("escapes `-` in a way compatible with PCRE", async (t) => {
  t.same(escapeStringRegexp("foo - bar"), "foo \\x2d bar");
});

t.test("escapes `-` in a way compatible with the Unicode flag", async (t) => {
  t.ok(new RegExp(escapeStringRegexp("-"), "u").test("-"));
});
