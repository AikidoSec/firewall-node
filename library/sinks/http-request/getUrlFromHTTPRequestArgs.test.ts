import * as t from "tap";
import { getUrlFromHTTPRequestArgs as getURL } from "./getUrlFromHTTPRequestArgs";

t.test("it works with strings", async (t) => {
  t.same(
    getURL(["http://localhost:4000"], "http"),
    new URL("http://localhost:4000")
  );
  t.same(getURL(["http://localhost"], "http"), new URL("http://localhost"));
  t.same(getURL(["https://localhost"], "https"), new URL("https://localhost"));
  t.same(getURL(["ftp://localhost"], "http"), new URL("ftp://localhost"));
});

t.test("it works with URLs", async (t) => {
  t.same(
    getURL([new URL("http://localhost:4000")], "http"),
    new URL("http://localhost:4000")
  );
  t.same(
    getURL([new URL("http://localhost")], "http"),
    new URL("http://localhost")
  );
  t.same(
    getURL([new URL("https://localhost")], "https"),
    new URL("https://localhost")
  );
  t.same(
    getURL([new URL("ftp://localhost")], "http"),
    new URL("ftp://localhost")
  );
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
    getURL([new URL("http://localhost:4000"), { port: 3000 }], "http"),
    new URL("http://localhost:3000")
  );
  t.same(
    getURL(
      [new URL("http://localhost:4000"), { port: 3000, path: "/test?q=1" }],
      "http"
    ),
    new URL("http://localhost:3000/test?q=1")
  );
});

t.test("it wraps host and hostname with square brackets", async (t) => {
  t.same(
    getURL([{ protocol: "http:", host: "::", port: 80 }], "http"),
    new URL("http://[::]:80")
  );
  t.same(
    getURL([{ protocol: "http:", hostname: "::", port: 80 }], "http"),
    new URL("http://[::]:80")
  );
});

t.test("it does not throw on invalid arguments", async (t) => {
  t.same(getURL([], "http"), undefined);
  t.same(getURL(["%test%"], undefined), undefined);
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
    getURL([{ hostname: "localhost", path: "/test" }], "http"),
    new URL("http://localhost/test")
  );
  t.same(
    getURL([{ hostname: "localhost", path: "/test?q=1" }], "https"),
    new URL("https://localhost/test?q=1")
  );
});

t.test("Do not get port 0 from request options", async (t) => {
  t.same(
    getURL([{ protocol: "https:", hostname: "localhost", port: 0 }], "http"),
    new URL("https://localhost")
  );
  t.same(
    getURL([{ hostname: "localhost", port: 0 }], "http"),
    new URL("http://localhost")
  );
  t.same(
    getURL([{ protocol: "https:", hostname: "localhost", port: 0 }], "https"),
    new URL("https://localhost")
  );
  t.same(
    getURL([{ hostname: "localhost", port: 0 }], "https"),
    new URL("https://localhost")
  );
});

t.test("Pass port as string", async (t) => {
  t.same(
    getURL(
      [{ protocol: "https:", hostname: "localhost", port: "4000" }],
      "https"
    ),
    new URL("https://localhost:4000")
  );
  t.same(
    getURL(["https://localhost", { port: "4000" }], "https"),
    new URL("https://localhost:4000")
  );
});

t.test("Pass host instead of hostname", async (t) => {
  t.same(
    getURL([{ protocol: "https:", host: "localhost:4000" }], "https"),
    new URL("https://localhost:4000")
  );
  t.same(
    getURL(["https://localhost", { host: "test.dev" }], "https"),
    new URL("https://test.dev")
  );
});

t.test("it works with node:url object as first argument", async (t) => {
  const oldUrl = require("url");

  t.same(
    getURL([oldUrl.parse("http://localhost:4000")], "http"),
    new URL("http://localhost:4000")
  );
});
