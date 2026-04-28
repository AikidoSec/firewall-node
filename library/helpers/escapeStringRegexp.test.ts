import * as t from "tap";
import { escapeStringRegexp } from "./escapeStringRegexp";

const isUsingBuiltIn = typeof (globalThis as any).RegExp?.escape === "function";

if (!isUsingBuiltIn) {
  t.test("main", async (t) => {
    t.same(
      escapeStringRegexp("\\ ^ $ * + ? . ( ) | { } [ ]"),
      "\\\\ \\^ \\$ \\* \\+ \\? \\. \\( \\) \\| \\{ \\} \\[ \\]"
    );
    t.same(escapeStringRegexp("hello world"), "hello world");
  });

  t.test("escapes `-` in a way compatible with PCRE", async (t) => {
    t.same(escapeStringRegexp("foo - bar"), "foo \\x2d bar");
  });

  t.test("escapes `-` in a way compatible with the Unicode flag", async (t) => {
    t.ok(new RegExp(escapeStringRegexp("-"), "u").test("-"));
  });
} else {
  t.same(
    escapeStringRegexp("\\ ^ $ * + ? . ( ) | { } [ ]"),
    "\\\\\\x20\\^\\x20\\$\\x20\\*\\x20\\+\\x20\\?\\x20\\.\\x20\\(\\x20\\)\\x20\\|\\x20\\{\\x20\\}\\x20\\[\\x20\\]"
  );

  t.test("escapes `-` in a way compatible with PCRE", async (t) => {
    t.same(escapeStringRegexp("foo - bar"), "\\x66oo\\x20\\x2d\\x20bar");
  });

  t.test("escapes `-` in a way compatible with the Unicode flag", async (t) => {
    t.ok(new RegExp(escapeStringRegexp("-"), "u").test("-"));
  });
}

t.test("escaped regex matches correctly", async (t) => {
  t.ok(new RegExp(escapeStringRegexp("hello world")).test("hello world"));
  t.ok(
    new RegExp(escapeStringRegexp("hello world \\d")).test("hello world \\d")
  );
  t.ok(new RegExp(escapeStringRegexp("hello\\sworld")).test("hello\\sworld"));

  t.notOk(
    new RegExp(escapeStringRegexp("hello world \\d")).test("hello world 1")
  );
  t.notOk(new RegExp(escapeStringRegexp("hello\\sworld")).test("hello sworld"));
});
