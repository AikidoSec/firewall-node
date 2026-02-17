import * as t from "tap";
import { getRequestUrlFromStream } from "./getRequestUrlFromStream";

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUST_PROXY;
});

t.test("returns undefined when headers is undefined", async (t) => {
  t.equal(getRequestUrlFromStream(undefined), undefined);
});

t.test("returns undefined when no path and no host", async (t) => {
  t.equal(getRequestUrlFromStream({}), undefined);
});

t.test("returns path when no host is available", async (t) => {
  t.equal(getRequestUrlFromStream({ ":path": "/some/path" }), "/some/path");
});

t.test("returns full URL with authority and path", async (t) => {
  t.equal(
    getRequestUrlFromStream({
      ":path": "/some/path",
      ":authority": "example.com",
    }),
    "http://example.com/some/path"
  );
});

t.test("uses x-forwarded-host when trust proxy is enabled", async (t) => {
  t.equal(
    getRequestUrlFromStream({
      ":path": "/forwarded/path",
      ":authority": "original.com",
      "x-forwarded-host": "forwarded.com",
    }),
    "http://forwarded.com/forwarded/path"
  );
});

t.test("ignores x-forwarded-host when trust proxy is disabled", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "0";

  t.equal(
    getRequestUrlFromStream({
      ":path": "/forwarded/path",
      ":authority": "original.com",
      "x-forwarded-host": "forwarded.com",
    }),
    "http://original.com/forwarded/path"
  );
});

t.test("uses x-forwarded-proto for protocol", async (t) => {
  t.equal(
    getRequestUrlFromStream({
      ":path": "/secure/path",
      ":authority": "example.com",
      "x-forwarded-proto": "https",
    }),
    "https://example.com/secure/path"
  );
});

t.test("uses x-forwarded-protocol for protocol", async (t) => {
  t.equal(
    getRequestUrlFromStream({
      ":path": "/secure/path",
      ":authority": "example.com",
      "x-forwarded-protocol": "HTTPS",
    }),
    "https://example.com/secure/path"
  );
});

t.test("ignores x-forwarded-proto when trust proxy is disabled", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "0";

  t.equal(
    getRequestUrlFromStream({
      ":path": "/secure/path",
      ":authority": "example.com",
      "x-forwarded-proto": "https",
    }),
    "http://example.com/secure/path"
  );
});

t.test("uses :scheme header for protocol when https", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "0";

  t.equal(
    getRequestUrlFromStream({
      ":path": "/secure/path",
      ":authority": "example.com",
      ":scheme": "https",
    }),
    "https://example.com/secure/path"
  );
});

t.test("defaults to http when :scheme is not https", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "0";

  t.equal(
    getRequestUrlFromStream({
      ":path": "/path",
      ":authority": "example.com",
      ":scheme": "http",
    }),
    "http://example.com/path"
  );
});

t.test("ignores invalid x-forwarded-proto values", async (t) => {
  t.equal(
    getRequestUrlFromStream({
      ":path": "/path",
      ":authority": "example.com",
      "x-forwarded-proto": "invalid",
    }),
    "http://example.com/path"
  );
});

t.test("prefers x-forwarded-proto over x-forwarded-protocol", async (t) => {
  t.equal(
    getRequestUrlFromStream({
      ":path": "/path",
      ":authority": "example.com",
      "x-forwarded-proto": "https",
      "x-forwarded-protocol": "http",
    }),
    "https://example.com/path"
  );
});

t.test("handles empty path", async (t) => {
  t.equal(
    getRequestUrlFromStream({
      ":path": "",
      ":authority": "example.com",
    }),
    "http://example.com"
  );
});
