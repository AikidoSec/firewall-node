import * as t from "tap";
import { getPortFromHTTPRequestArgs as getPort } from "./getPortFromRequest";

t.test("it works with strings", async (t) => {
  t.same(getPort(["http://localhost:4000"]), 4000);
  t.same(getPort(["http://localhost"]), 80);
  t.same(getPort(["https://localhost"]), 443);
  t.same(getPort(["https://test.com:8080"]), 8080);
  t.same(getPort(["ftp://localhost"]), undefined);
});

t.test("it works with url objects", async (t) => {
  t.same(getPort([new URL("http://localhost:4000")]), 4000);
  t.same(getPort([new URL("http://localhost")]), 80);
  t.same(getPort([new URL("https://localhost")]), 443);
  t.same(getPort([new URL("https://test.com:8080")]), 8080);
  t.same(getPort([new URL("ftp://localhost")]), undefined);
});

t.test("it works with options objects", async (t) => {
  t.same(getPort([{ hostname: "localhost", port: 4000 }]), 4000);
  t.same(getPort([{ hostname: "localhost", port: 443 }]), 443);
  t.same(getPort([{ hostname: "localhost", defaultPort: 443 }]), 443);
  t.same(getPort([{ hostname: "localhost", port: "443" }]), 443);
  t.same(getPort([{ hostname: "localhost", defaultPort: "443" }]), 443);
});

t.test("it works with options objects in second position", async (t) => {
  t.same(
    getPort(["http://localhost", { hostname: "localhost", port: 4000 }]),
    4000
  );
  t.same(getPort(["http://localhost", { hostname: "localhost" }]), 80);
  t.same(
    getPort(["http://localhost", { hostname: "localhost", port: 443 }]),
    443
  );
});

t.test("it works with options without port", async (t) => {
  t.same(getPort([{ hostname: "localhost" }], "http"), 80);
  t.same(getPort([{ hostname: "example.com" }], "https"), 443);
});

t.test("it does not work with options without port and module", async (t) => {
  t.same(getPort([{ hostname: "localhost" }]), undefined);
  t.same(getPort([{ hostname: "example.com" }]), undefined);
});

t.test("it does not work without arguments", async (t) => {
  t.same(getPort([]), undefined);
  // @ts-expect-error Testing invalid input
  t.same(getPort(), undefined);
});

t.test("It ignores invalid url", async (t) => {
  t.same(getPort(["invalid url"]), undefined);
});
