import * as t from "tap";
import { Agent } from "http";
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
    getURL([{ protocol: "http:", host: "::", port: 80 }], "http")?.href,
    new URL("http://[::]:80").href
  );
  t.same(
    getURL([{ protocol: "http:", hostname: "::", port: 80 }], "http")?.href,
    new URL("http://[::]:80").href
  );
  t.same(
    getURL([new URL("http://domain.com"), { hostname: "::" }], "http")?.href,
    new URL("http://[::]:80").href
  );
  t.same(
    getURL([new URL("http://domain.com"), { host: "::" }], "http")?.href,
    new URL("http://[::]:80").href
  );
  t.same(
    getURL([new URL("http://[::]")], "http")?.href,
    new URL("http://[::]:80").href
  );
});

t.test("it does not throw on invalid arguments", async (t) => {
  t.same(getURL([], "http"), undefined);
  // @ts-expect-error Test
  t.same(getURL(["%test%"], undefined), undefined);
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

t.test("it uses node's defaults for empty or missing options", async (t) => {
  t.same(
    getURL([{ protocol: "", hostname: "127.0.0.1", path: "/" }], "http")?.href,
    "http://127.0.0.1/"
  );
  t.same(
    getURL([{ protocol: "", hostname: "127.0.0.1", path: "/" }], "https")?.href,
    "https://127.0.0.1/"
  );
  t.same(
    getURL([{ hostname: "", host: "127.0.0.1", path: "/" }], "http")?.href,
    "http://127.0.0.1/"
  );
  t.same(
    getURL([{ port: 2375, path: "/" }], "http")?.href,
    "http://localhost:2375/"
  );
  t.same(
    getURL([{ hostname: "", host: "", port: 2375, path: "/" }], "http")?.href,
    "http://localhost:2375/"
  );
  t.same(getURL([{ path: "/" }], "https")?.href, "https://localhost/");
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

t.test("it uses defaultPort when port is not set", async (t) => {
  t.same(
    getURL([{ defaultPort: 2375 }], "http"),
    new URL("http://localhost:2375")
  );
  t.same(
    getURL([{ hostname: "localhost", defaultPort: "2375" }], "http"),
    new URL("http://localhost:2375")
  );
  t.same(
    getURL([{ defaultPort: 2375, path: "/containers/json" }], "http"),
    new URL("http://localhost:2375/containers/json")
  );
  // port takes precedence over defaultPort
  t.same(
    getURL([{ port: 3000, defaultPort: 2375 }], "http"),
    new URL("http://localhost:3000")
  );
  // Merged with a url argument
  t.same(
    getURL(["http://example.com", { defaultPort: 2375 }], "http"),
    new URL("http://example.com:2375")
  );
  // Explicit port in the url takes precedence over defaultPort
  t.same(
    getURL(["http://example.com:3000", { defaultPort: 2375 }], "http"),
    new URL("http://example.com:3000")
  );
  // options.port still takes precedence over the url port
  t.same(
    getURL(
      ["http://example.com:3000", { port: 4000, defaultPort: 2375 }],
      "http"
    ),
    new URL("http://example.com:4000")
  );
});

t.test("it uses agent.defaultPort when no port is set", async (t) => {
  const agent = new Agent({ defaultPort: 8080 } as any);
  t.same(
    getURL([{ hostname: "example.com", agent }], "http"),
    new URL("http://example.com:8080")
  );
  t.same(
    getURL(["http://example.com", { agent }], "http"),
    new URL("http://example.com:8080")
  );
  t.same(
    getURL([{ hostname: "example.com", port: 3000, agent }], "http"),
    new URL("http://example.com:3000")
  );
  t.same(
    getURL([{ hostname: "example.com", defaultPort: 2375, agent }], "http"),
    new URL("http://example.com:2375")
  );
  t.same(
    getURL(["http://example.com:3000", { agent }], "http"),
    new URL("http://example.com:3000")
  );
  t.same(
    getURL([{ hostname: "example.com", agent: false }], "http"),
    new URL("http://example.com")
  );
});

t.test("a path cannot inject a URL authority", async (t) => {
  t.same(
    getURL([{ hostname: "127.0.0.1", path: "@public.example/" }], "http")
      ?.hostname,
    "127.0.0.1"
  );
  t.same(
    getURL(
      [
        "http://example.com/",
        { hostname: "127.0.0.1", path: "@public.example/" },
      ],
      "http"
    )?.hostname,
    "127.0.0.1"
  );
});
