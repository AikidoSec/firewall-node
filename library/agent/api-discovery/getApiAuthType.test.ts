import * as t from "tap";
import { getApiAuthType as get } from "./getApiAuthType";
import type { Context } from "../Context";

function getContext(
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {}
): Context {
  return {
    method: "GET",
    route: "/test",
    headers,
    body: undefined,
    remoteAddress: "",
    url: `http://localhost/test`,
    routeParams: {},
    query: {},
    cookies,
    source: "test",
  };
}

t.test("it detects authorization header", async (t) => {
  t.same(get(getContext({ authorization: "Bearer token" })), [
    { type: "http", scheme: "bearer" },
  ]);
  t.same(get(getContext({ authorization: "Basic base64" })), [
    { type: "http", scheme: "basic" },
  ]);
  t.same(get(getContext({ authorization: "custom" })), [
    { type: "apiKey", in: "header", name: "Authorization" },
  ]);
});

t.test("it detects api keys", async (t) => {
  t.same(get(getContext({ "x-api-key": "token" })), [
    { type: "apiKey", in: "header", name: "x-api-key" },
  ]);
  t.same(get(getContext({ "api-key": "token" })), [
    { type: "apiKey", in: "header", name: "api-key" },
  ]);
});

t.test("it doesn't add the same api key again", async () => {
  t.same(get(getContext({ "api-key": "token", "api-key-a": "token" })), [
    { type: "apiKey", in: "header", name: "api-key" },
    { type: "apiKey", in: "header", name: "api-key-a" },
  ]);
  t.same(get(getContext({ "api-key": "token", "api-key-apikey": "token" })), [
    { type: "apiKey", in: "header", name: "api-key" },
    { type: "apiKey", in: "header", name: "api-key-apikey" },
  ]);
});

t.test("it detects auth cookies", async (t) => {
  t.same(get(getContext({}, { "api-key": "token" })), [
    { type: "apiKey", in: "cookie", name: "api-key" },
  ]);
  t.same(get(getContext({}, { session: "test" })), [
    {
      type: "apiKey",
      in: "cookie",
      name: "session",
    },
  ]);
});

t.test("it detects multiple auth cookies", async (t) => {
  t.same(get(getContext({}, { "api-key": "token", "api-key-a": "token" })), [
    { type: "apiKey", in: "cookie", name: "api-key" },
    { type: "apiKey", in: "cookie", name: "api-key-a" },
  ]);
  t.same(get(getContext({}, { "api-key": "token", "api-key-sid": "token" })), [
    { type: "apiKey", in: "cookie", name: "api-key-sid" },
    { type: "apiKey", in: "cookie", name: "api-key" },
  ]);
});

t.test("it detects cookies and api keys at same time", async (t) => {
  t.same(
    get(
      getContext(
        {
          "api-key": "token",
        },
        { "api-key": "token" }
      )
    ),
    [
      { type: "apiKey", in: "header", name: "api-key" },
      { type: "apiKey", in: "cookie", name: "api-key" },
    ]
  );

  t.same(
    get(
      getContext(
        {
          "x-api-key": "token",
        },
        { "api-key": "token" }
      )
    ),
    [
      { type: "apiKey", in: "header", name: "x-api-key" },
      { type: "apiKey", in: "cookie", name: "api-key" },
    ]
  );
});

t.test("no auth", async (t) => {
  t.same(get(getContext()), undefined);
  t.same(get(getContext({})), undefined);
  t.same(get(getContext({ authorization: "" })), undefined);
  // @ts-expect-error Testing edge case
  t.same(get({}), undefined);
});
