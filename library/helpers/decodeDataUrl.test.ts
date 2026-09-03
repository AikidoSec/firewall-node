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

t.test("malformed percent-encoding returns undefined", async (t) => {
  const url = new URL("data:text/javascript,%");
  t.equal(decodeDataUrl(url), undefined);
});

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
