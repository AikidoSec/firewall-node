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

t.test("no auth", async (t) => {
  t.same(get(getContext()), undefined);
  t.same(get(getContext({})), undefined);
  t.same(get(getContext({ authorization: "" })), undefined);
  t.same(get({}), undefined);
});

t.test("multiple auth types", async (t) => {
  t.same(
    get(
      getContext(
        {
          authorization: "Basic base64",
          "x-api-key": "token",
        },
        {
          session: "test",
        }
      )
    ),
    [
      { type: "http", scheme: "basic" },
      { type: "apiKey", in: "header", name: "x-api-key" },
      {
        type: "apiKey",
        in: "cookie",
        name: "session",
      },
    ]
  );
});

t.test("detect bearer format", async (t) => {
  t.same(
    get(
      getContext({
        authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      })
    ),
    [{ type: "http", scheme: "bearer", bearerFormat: "JWT" }]
  );
});
