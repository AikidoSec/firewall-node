import * as t from "tap";
import isEmail from "./isEmail";

t.test("is a valid email", async (t) => {
  t.same(isEmail("hello@example.com"), true);
  t.same(isEmail("hello@aikido.dev"), true);
  t.same(isEmail("hello+test@aikido.dev"), true);
});

t.test("is not a valid email", async (t) => {
  // Technically valid but unsupported
  t.same(isEmail('"ö"@ö.de'), false);
  t.same(isEmail("ö@example.com"), false);
  t.same(isEmail("info@abcö.de"), false);

  t.same(isEmail(""), false);
  t.same(isEmail("example"), false);
  t.same(isEmail("@"), false);
  t.same(isEmail("@.com"), false);
  t.same(isEmail("@example.com"), false);
  t.same(isEmail(".@example.com"), false);
  t.same(isEmail("hello@.com"), false);
  t.same(isEmail("hello@com"), false);
  t.same(isEmail("foo.bar@gmail"), false);
  t.same(isEmail("hello@com."), false);
  t.same(isEmail("hello@.com."), false);
  t.same(isEmail("hello@.com"), false);
  t.same(isEmail("hello@com."), false);
  t.same(isEmail("hello@com.."), false);
  t.same(isEmail("hello@example.com."), false);
  t.same(isEmail("hello@.example.com"), false);
  t.same(isEmail("hell o@example.com"), false);
  t.same(isEmail("abcde".repeat(64) + "@example.com"), false);
});
