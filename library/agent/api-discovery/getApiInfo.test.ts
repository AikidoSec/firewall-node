import * as t from "tap";
import { getApiInfo } from "./getApiInfo";
import type { Context } from "../Context";

function getContext(headers: Context["headers"], body: unknown): Context {
  return {
    method: "POST",
    route: "/test",
    headers,
    body,
    remoteAddress: "",
    url: "http://localhost/test",
    routeParams: {},
    query: {},
    cookies: {},
    source: "test",
  };
}

t.test("it discovers the body schema for small bodies", async (t) => {
  t.same(
    getApiInfo(
      getContext(
        { "content-type": "application/json", "content-length": "15" },
        { a: 1 }
      )
    ),
    {
      body: {
        type: "json",
        schema: { type: "object", properties: { a: { type: "number" } } },
      },
      query: undefined,
      auth: undefined,
    }
  );
});

t.test("it discovers the body schema at exactly 1 MiB", async (t) => {
  const info = getApiInfo(
    getContext(
      {
        "content-type": "application/json",
        "content-length": String(1024 * 1024),
      },
      { a: 1 }
    )
  );
  t.ok(info?.body);
});

t.test("it discovers the body schema without content-length", async (t) => {
  const info = getApiInfo(
    getContext({ "content-type": "application/json" }, { a: 1 })
  );
  t.ok(info?.body);
});

t.test("it ignores invalid content-length", async (t) => {
  const info = getApiInfo(
    getContext(
      { "content-type": "application/json", "content-length": "abc" },
      { a: 1 }
    )
  );
  t.ok(info?.body);
});

t.test("it skips the body schema for bodies larger than 1 MiB", async (t) => {
  t.same(
    getApiInfo(
      getContext(
        {
          "content-type": "application/json",
          "content-length": String(1024 * 1024 + 1),
        },
        { a: 1 }
      )
    ),
    undefined
  );
});

t.test(
  "it skips the body schema when content-length is an array",
  async (t) => {
    t.same(
      getApiInfo(
        getContext(
          {
            "content-type": "application/json",
            "content-length": [String(2 * 1024 * 1024)],
          },
          { a: 1 }
        )
      ),
      undefined
    );
  }
);

t.test("it still returns auth info for large bodies", async (t) => {
  t.same(
    getApiInfo(
      getContext(
        {
          "content-type": "application/json",
          "content-length": String(2 * 1024 * 1024),
          authorization: "Bearer token",
        },
        { a: 1 }
      )
    ),
    {
      body: undefined,
      query: undefined,
      auth: [{ type: "http", scheme: "bearer" }],
    }
  );
});
