import * as t from "tap";
import { Routes } from "./Routes";
import { Context } from "./Context";

function getContext(
  method: string,
  route: string,
  headers: Record<string, string> = {},
  body: any = undefined,
  query: Record<string, string> = {},
  cookies: Record<string, string> = {}
): Context {
  return {
    method,
    route,
    headers,
    body,
    remoteAddress: "",
    url: `http://localhost${route}`,
    routeParams: {},
    query,
    cookies,
    source: "test",
  };
}

t.test("it works", async (t) => {
  const routes = new Routes(3);
  t.same(routes.asArray(), []);

  routes.addRoute(getContext("GET", "/users"));
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/users",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);

  // @ts-expect-error - Invalid arguments
  routes.addRoute(getContext(undefined, undefined));
  routes.addRoute(getContext("GET", "/users"));
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/users",
      hits: 2,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);

  routes.addRoute(getContext("POST", "/users"));
  t.same(
    routes.asArray(),
    [
      {
        method: "GET",
        path: "/users",
        hits: 2,
        graphql: undefined,
        body: undefined,
        query: undefined,
        auth: undefined,
      },
      {
        method: "POST",
        path: "/users",
        hits: 1,
        graphql: undefined,
        body: undefined,
        query: undefined,
        auth: undefined,
      },
    ],
    "Should add second route"
  );

  routes.addRoute(getContext("PUT", "/users/1"));
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/users",
      hits: 2,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "POST",
      path: "/users",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "PUT",
      path: "/users/1",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);

  routes.addRoute(getContext("DELETE", "/users/1"));
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/users",
      hits: 2,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "PUT",
      path: "/users/1",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "DELETE",
      path: "/users/1",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);

  routes.clear();
  t.same(routes.asArray(), []);
});

t.test("it adds GraphQL fields", async (t) => {
  const routes = new Routes(200);
  routes.addRoute(getContext("POST", "/graphql"));
  routes.addGraphQLField("POST", "/graphql", "query", "user");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: { type: "query", name: "user" },
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "query", "user");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      graphql: { type: "query", name: "user" },
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "query", "post");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      graphql: { type: "query", name: "user" },
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: {
        type: "query",
        name: "post",
      },
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "mutation", "post");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      graphql: { type: "query", name: "user" },
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: {
        type: "query",
        name: "post",
      },
      body: undefined,
      query: undefined,
      auth: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: {
        type: "mutation",
        name: "post",
      },
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);
});

t.test("it adds body schema", async (t) => {
  const routes = new Routes(200);

  routes.addRoute(
    getContext(
      "POST",
      "/body",
      { "content-type": "application/json" },
      { test: "abc", arr: [1, 2, 3], sub: { x: 123 } }
    )
  );
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/body",
      hits: 1,
      graphql: undefined,
      query: undefined,
      auth: undefined,
      body: {
        type: "json",
        schema: {
          type: "object",
          properties: {
            test: {
              type: "string",
            },
            arr: {
              type: "array",
              items: {
                type: "number",
              },
            },
            sub: {
              type: "object",
              properties: {
                x: {
                  type: "number",
                },
              },
            },
          },
        },
      },
    },
  ]);
});

t.test("it merges body schema", async (t) => {
  const routes = new Routes(200);
  t.same(routes.asArray(), []);
  routes.addRoute(getContext("POST", "/body"));
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/body",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);

  routes.addRoute(
    getContext(
      "POST",
      "/body",
      { "content-type": "application/json" },
      { test: "abc", arr: [1, 2, 3], sub: { y: 123 } }
    )
  );
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/body",
      hits: 2,
      graphql: undefined,
      query: undefined,
      auth: undefined,
      body: {
        type: "json",
        schema: {
          type: "object",
          properties: {
            test: {
              type: "string",
            },
            arr: {
              type: "array",
              items: {
                type: "number",
              },
            },
            sub: {
              type: "object",
              properties: {
                y: {
                  type: "number",
                },
              },
            },
          },
        },
      },
    },
  ]);

  routes.addRoute(
    getContext(
      "POST",
      "/body",
      { "content-type": "application/json" },
      { test: "abc", arr: [1, 2, 3], test2: 1, sub: { x: 123 } }
    )
  );
  routes.addRoute(getContext("POST", "/body"));
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/body",
      hits: 4,
      graphql: undefined,
      query: undefined,
      auth: undefined,
      body: {
        type: "json",
        schema: {
          type: "object",
          properties: {
            test: {
              type: "string",
            },
            arr: {
              type: "array",
              items: {
                type: "number",
              },
            },
            sub: {
              type: "object",
              properties: {
                y: {
                  type: "number",
                  optional: true,
                },
                x: {
                  type: "number",
                  optional: true,
                },
              },
            },
            test2: {
              type: "number",
              optional: true,
            },
          },
        },
      },
    },
  ]);
});

t.test("it adds query schema", async (t) => {
  const routes = new Routes(200);

  routes.addRoute(
    getContext("GET", "/query", {}, undefined, { test: "abc", t: "123" })
  );
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/query",
      hits: 1,
      graphql: undefined,
      body: undefined,
      auth: undefined,
      query: {
        type: "object",
        properties: {
          test: {
            type: "string",
          },
          t: {
            type: "string",
          },
        },
      },
    },
  ]);
});

t.test("it merges query schema", async (t) => {
  const routes = new Routes(200);
  t.same(routes.asArray(), []);
  routes.addRoute(getContext("GET", "/query"));
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/query",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: undefined,
    },
  ]);
  routes.addRoute(getContext("GET", "/query", {}, undefined, { test: "abc" }));
  routes.addRoute(
    getContext("GET", "/query", {}, undefined, { x: "123", test: "abc" })
  );
  routes.addRoute(getContext("GET", "/query"));
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/query",
      hits: 4,
      graphql: undefined,
      body: undefined,
      auth: undefined,
      query: {
        type: "object",
        properties: {
          test: {
            type: "string",
          },
          x: {
            type: "string",
            optional: true,
          },
        },
      },
    },
  ]);
});

t.test("it adds auth schema", async (t) => {
  const routes = new Routes(200);

  routes.addRoute(
    getContext("GET", "/auth", { authorization: "Bearer token" })
  );
  routes.addRoute(
    getContext("GET", "/auth2", {}, undefined, {}, { session: "test" })
  );
  routes.addRoute(getContext("GET", "/auth3", { "x-api-key": "token" }));

  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/auth",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: [{ type: "http", scheme: "Bearer" }],
    },
    {
      method: "GET",
      path: "/auth2",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: [{ type: "apiKey", in: "cookie", name: "session" }],
    },
    {
      method: "GET",
      path: "/auth3",
      hits: 1,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: [{ type: "apiKey", in: "header", name: "x-api-key" }],
    },
  ]);
});

t.test("it merges auth schema", async (t) => {
  const routes = new Routes(200);
  t.same(routes.asArray(), []);
  routes.addRoute(getContext("GET", "/auth"));
  routes.addRoute(
    getContext("GET", "/auth", { authorization: "Bearer token" })
  );
  routes.addRoute(getContext("GET", "/auth", { authorization: "Basic token" }));
  routes.addRoute(getContext("GET", "/auth", { "x-api-key": "token" }));
  routes.addRoute(getContext("GET", "/auth"));

  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/auth",
      hits: 5,
      graphql: undefined,
      body: undefined,
      query: undefined,
      auth: [
        { type: "http", scheme: "Bearer" },
        { type: "http", scheme: "Basic" },
        { type: "apiKey", in: "header", name: "x-api-key" },
      ],
    },
  ]);
});
