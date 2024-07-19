import * as t from "tap";
import { getPortFromHTTPRequestOptions } from "./getPortFromRequest";

t.test("it works with strings", async (t) => {
  t.same(getPortFromHTTPRequestOptions(["http://localhost:4000"]), 4000);
  t.same(getPortFromHTTPRequestOptions(["http://localhost"]), 80);
  t.same(getPortFromHTTPRequestOptions(["https://localhost"]), 443);
  t.same(getPortFromHTTPRequestOptions(["https://test.com:8080"]), 8080);
  t.same(getPortFromHTTPRequestOptions(["ftp://localhost"]), undefined);
});

t.test("it works with url objects", async (t) => {
  t.same(
    getPortFromHTTPRequestOptions([new URL("http://localhost:4000")]),
    4000
  );
  t.same(getPortFromHTTPRequestOptions([new URL("http://localhost")]), 80);
  t.same(getPortFromHTTPRequestOptions([new URL("https://localhost")]), 443);
  t.same(
    getPortFromHTTPRequestOptions([new URL("https://test.com:8080")]),
    8080
  );
  t.same(
    getPortFromHTTPRequestOptions([new URL("ftp://localhost")]),
    undefined
  );
});

t.test("it works with options objects", async (t) => {
  t.same(
    getPortFromHTTPRequestOptions([{ hostname: "localhost", port: 4000 }]),
    4000
  );
  t.same(
    getPortFromHTTPRequestOptions([{ hostname: "localhost", port: 443 }]),
    443
  );
  t.same(
    getPortFromHTTPRequestOptions([
      { hostname: "localhost", defaultPort: 443 },
    ]),
    443
  );
  t.same(
    getPortFromHTTPRequestOptions([{ hostname: "localhost", port: "443" }]),
    443
  );
  t.same(
    getPortFromHTTPRequestOptions([
      { hostname: "localhost", defaultPort: "443" },
    ]),
    443
  );
});

t.test("it works with options objects in second position", async (t) => {
  t.same(
    getPortFromHTTPRequestOptions([
      "http://localhost",
      { hostname: "localhost", port: 4000 },
    ]),
    4000
  );
  t.same(
    getPortFromHTTPRequestOptions([
      "http://localhost",
      { hostname: "localhost" },
    ]),
    80
  );
  t.same(
    getPortFromHTTPRequestOptions([
      "http://localhost",
      { hostname: "localhost", port: 443 },
    ]),
    443
  );
});

t.test("it works with options without port", async (t) => {
  t.same(
    getPortFromHTTPRequestOptions([{ hostname: "localhost" }], "http"),
    80
  );
  t.same(
    getPortFromHTTPRequestOptions([{ hostname: "example.com" }], "https"),
    443
  );
});

t.test("it does not work with options without port and module", async (t) => {
  t.same(getPortFromHTTPRequestOptions([{ hostname: "localhost" }]), undefined);
  t.same(
    getPortFromHTTPRequestOptions([{ hostname: "example.com" }]),
    undefined
  );
});

t.test("it does not work without arguments", async (t) => {
  t.same(getPortFromHTTPRequestOptions([]), undefined);
  // @ts-expect-error Testing invalid input
  t.same(getPortFromHTTPRequestOptions(), undefined);
});

t.test("It ignores invalid url", async (t) => {
  t.same(getPortFromHTTPRequestOptions(["invalid url"]), undefined);
});
