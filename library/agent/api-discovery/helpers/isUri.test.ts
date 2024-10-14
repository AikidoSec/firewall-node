import t from "tap";
import isUri from "./isUri";

t.test("is a valid URI", async (t) => {
  t.same(isUri("http://example.com"), true);
  t.same(isUri("https://example.com"), true);
  t.same(isUri("ftp://example.com"), true);
  t.same(isUri("http://example.com:8080"), true);
  t.same(isUri("http://example.com:8080/"), true);
  t.same(isUri("http://example.com:8080/foo/bar"), true);
  t.same(isUri("http://example.com:8080/foo/bar?baz=qux"), true);
  t.same(isUri("http://example.com:8080/foo/bar?baz=qux#quux"), true);
  t.same(
    isUri("http://example.com:8080/foo/bar?baz=qux#quux?corge=grault"),
    true
  );
  t.same(isUri("test://example.com"), true);
  t.same(isUri("test://example.com:8080"), true);
});

t.test("is not a valid URI", async (t) => {
  t.same(isUri(""), false);
  t.same(isUri("example"), false);
  t.same(isUri("example.com"), false);
  t.same(isUri("example.com:8080"), false);
  t.same(isUri("test:"), false);
  t.same(isUri("://example.com"), false);
  t.same(isUri("//example.com"), false);
  t.same(isUri("http://" + "a".repeat(2084)), false);
});
