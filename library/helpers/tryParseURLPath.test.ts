import t from "tap";
import { tryParseURLPath } from "./tryParseURLPath";

t.test("it returns undefined if nothing found", async () => {
  t.equal(tryParseURLPath("abc"), undefined);
});

t.test("it returns pathname for /", async () => {
  t.equal(tryParseURLPath("/"), "/");
});

t.test("it returns pathname for relative URL", async () => {
  t.equal(tryParseURLPath("/posts"), "/posts");
});

t.test("it returns pathname for relative URL with query", async () => {
  t.equal(tryParseURLPath("/posts?abc=def"), "/posts");
});

t.test("it returns pathname", async () => {
  t.equal(tryParseURLPath("http://localhost/posts/3"), "/posts/3");
});

t.test("it returns pathname with query", async () => {
  t.equal(tryParseURLPath("http://localhost/posts/3?abc=def"), "/posts/3");
});

t.test("it returns pathname with hash", async () => {
  t.equal(tryParseURLPath("http://localhost/posts/3#abc"), "/posts/3");
});

t.test("it returns pathname with query and hash", async () => {
  t.equal(tryParseURLPath("http://localhost/posts/3?abc=def#ghi"), "/posts/3");
});

t.test("it returns pathname with query and hash and no path", async () => {
  t.equal(tryParseURLPath("http://localhost/?abc=def#ghi"), "/");
});

t.test("it returns pathname with query and no path", async () => {
  t.equal(tryParseURLPath("http://localhost?abc=def"), "/");
});

t.test("it returns pathname with hash and no path", async () => {
  t.equal(tryParseURLPath("http://localhost#abc"), "/");
});
