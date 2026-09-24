import * as t from "tap";
import { decodeDataUrl, isJsDataUrl } from "./decodeDataUrl";

t.test("plain percent-encoded body", async (t) => {
  const url = new URL("data:text/javascript,console.log(%271%27)");
  t.equal(decodeDataUrl(url), "console.log('1')");
});

t.test("base64 body", async (t) => {
  const code = "console.log(1+1)";
  const url = new URL(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
  t.equal(decodeDataUrl(url), code);
});

t.test("base64 body with whitespace in media type", async (t) => {
  const code = "console.log('base64')";
  const url = new URL(
    `data:text/javascript; base64,${Buffer.from(code).toString("base64")}`
  );
  t.equal(decodeDataUrl(url), code);
});

t.test("body with extra commas is preserved", async (t) => {
  const url = new URL("data:text/javascript,console.log(1)%2C(2)%2C(3)");
  t.equal(decodeDataUrl(url), "console.log(1),(2),(3)");
});

t.test("no comma separator returns undefined", async (t) => {
  const url = new URL("data:text/javascript");
  t.equal(decodeDataUrl(url), undefined);
});

t.test("malformed percent-encoding falls back to the raw body", async (t) => {
  const url = new URL("data:text/javascript,%");
  t.equal(decodeDataUrl(url), "%");
});

t.test(
  "malformed percent-encoding elsewhere still returns inspectable code instead of undefined",
  async (t) => {
    const url = new URL("data:text/javascript,console.log(%22%ZZ%22)");
    t.equal(decodeDataUrl(url), "console.log(%22%ZZ%22)");
  }
);

t.test("isJsDataUrl recognizes executable JS mime types", async (t) => {
  t.ok(isJsDataUrl(new URL("data:text/javascript,code")));
  t.ok(isJsDataUrl(new URL("data:application/javascript,code")));
  t.ok(isJsDataUrl(new URL("data:TEXT/JAVASCRIPT,code")));
  t.ok(isJsDataUrl(new URL("data:text/javascript;charset=utf-8,code")));
  t.ok(isJsDataUrl(new URL("data:text/javascript;base64,Y29kZQ==")));
});

t.test("isJsDataUrl rejects mime types Node will not execute", async (t) => {
  t.notOk(isJsDataUrl(new URL("data:text/plain,code")));
  t.notOk(isJsDataUrl(new URL("data:application/x-javascript,code")));
  t.notOk(isJsDataUrl(new URL("data:text/ecmascript,code")));
  t.notOk(isJsDataUrl(new URL("data:,code")));
});

t.test("accepts a plain string instead of a URL object", async (t) => {
  const code = "console.log(1+1)";
  const stringUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;

  t.ok(isJsDataUrl(stringUrl));
  t.equal(decodeDataUrl(stringUrl), code);
});

t.test("string input stops the path at the first ? or #", async (t) => {
  t.equal(
    decodeDataUrl("data:text/javascript,console.log(1)?a=b#hash"),
    "console.log(1)"
  );
  t.equal(
    decodeDataUrl("data:text/javascript,console.log(1)#hash?a=b"),
    "console.log(1)"
  );
});

t.test("string input with no comma separator returns undefined", async (t) => {
  t.equal(decodeDataUrl("data:text/javascript"), undefined);
});

t.test("rejects non-data: schemes", async (t) => {
  t.notOk(isJsDataUrl("https://example.com/text/javascript,code"));
  t.equal(decodeDataUrl("https://example.com/text/javascript,code"), undefined);

  t.notOk(isJsDataUrl(new URL("https://example.com/text/javascript,code")));
  t.equal(
    decodeDataUrl(new URL("https://example.com/text/javascript,code")),
    undefined
  );
});
