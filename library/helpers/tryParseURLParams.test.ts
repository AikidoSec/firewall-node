import * as t from "tap";
import { tryParseURLParams } from "./tryParseURLParams";

t.test("it returns undefined if invalid URL", async () => {
  t.same(tryParseURLParams("abc"), new URLSearchParams());
});

t.test("it returns search params for /", async () => {
  t.same(tryParseURLParams("/"), new URLSearchParams());
});

t.test("it returns search params for relative URL", async () => {
  t.same(tryParseURLParams("/posts"), new URLSearchParams());
});

t.test("it returns search params for relative URL with query", async () => {
  t.same(tryParseURLParams("/posts?abc=def"), new URLSearchParams("abc=def"));
});

t.test("it returns search params", async () => {
  t.same(tryParseURLParams("http://localhost/posts/3"), new URLSearchParams());
});

t.test("it returns search params with query", async () => {
  t.same(
    tryParseURLParams("http://localhost/posts/3?abc=def"),
    new URLSearchParams("abc=def")
  );
});
