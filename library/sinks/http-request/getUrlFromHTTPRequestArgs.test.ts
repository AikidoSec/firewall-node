import * as t from "tap";
import { getUrlFromHTTPRequestArgs as getURL } from "./getUrlFromHTTPRequestArgs";

t.test("it works with strings", async (t) => {
  t.same(getURL(["http://localhost:4000"]), new URL("http://localhost:4000"));
  t.same(getURL(["http://localhost"]), new URL("http://localhost"));
  t.same(getURL(["https://localhost"]), new URL("https://localhost"));
  t.same(getURL(["ftp://localhost"]), new URL("ftp://localhost"));
});

t.test("it works with URLs", async (t) => {
  t.same(
    getURL([new URL("http://localhost:4000")]),
    new URL("http://localhost:4000")
  );
  t.same(getURL([new URL("http://localhost")]), new URL("http://localhost"));
  t.same(getURL([new URL("https://localhost")]), new URL("https://localhost"));
  t.same(getURL([new URL("ftp://localhost")]), new URL("ftp://localhost"));
});

t.test("it works with options", async (t) => {
  t.same(
    getURL(["http://localhost:4000", { protocol: "https:" }], "http"),
    new URL("https://localhost:4000")
  );
  t.same(
    getURL(["https://localhost:4000", { hostname: "test.dev" }], "https"),
    new URL("https://test.dev:4000")
  );
  t.same(
    getURL([new URL("http://localhost:4000"), { port: 3000 }]),
    new URL("http://localhost:3000")
  );
  t.same(
    getURL([
      new URL("http://localhost:4000"),
      { port: 3000, path: "/test?q=1" },
    ]),
    new URL("http://localhost:3000/test?q=1")
  );
});

t.test("it does not throw on invalid arguments", async (t) => {
  t.same(getURL([]), undefined);
  t.same(getURL(["%test%"]), undefined);
  t.same(new Date(), []);
});

t.test("it works without url and only options", async (t) => {
  t.same(
    getURL([{ protocol: "https:", hostname: "localhost", port: 4000 }], "http"),
    new URL("https://localhost:4000")
  );
  t.same(
    getURL([{ hostname: "localhost", port: 4000 }], "http"),
    new URL("http://localhost:4000")
  );
  t.same(
    getURL([{ protocol: "https:", hostname: "localhost" }], "http"),
    new URL("https://localhost")
  );
  t.same(
    getURL([{ hostname: "localhost", path: "/test" }]),
    new URL("http://localhost/test")
  );
  t.same(
    getURL([{ hostname: "localhost", path: "/test?q=1" }], "https"),
    new URL("https://localhost/test?q=1")
  );
});
