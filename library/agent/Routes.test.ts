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

t.beforeEach(() => {
  delete process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES;
});

t.test("it works", async (t) => {
  const routes = new Routes(3);
  t.same(routes.asArray(), []);

  routes.addRoute(getContext("GET", "/users"));
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/users",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
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
        rateLimitedCount: 0,
        graphql: undefined,
        apispec: {},
        graphQLSchema: undefined,
      },
      {
        method: "POST",
        path: "/users",
        hits: 1,
        rateLimitedCount: 0,
        graphql: undefined,
        apispec: {},
        graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/users",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "PUT",
      path: "/users/1",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
  ]);

  routes.addRoute(getContext("DELETE", "/users/1"));
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/users",
      hits: 2,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "PUT",
      path: "/users/1",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "DELETE",
      path: "/users/1",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: { type: "query", name: "user" },
      apispec: {},
      graphQLSchema: undefined,
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "query", "user");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      rateLimitedCount: 0,
      graphql: { type: "query", name: "user" },
      apispec: {},
      graphQLSchema: undefined,
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "query", "post");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      rateLimitedCount: 0,
      graphql: { type: "query", name: "user" },
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: {
        type: "query",
        name: "post",
      },
      apispec: {},
      graphQLSchema: undefined,
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "mutation", "post");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      rateLimitedCount: 0,
      graphql: { type: "query", name: "user" },
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: {
        type: "query",
        name: "post",
      },
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: {
        type: "mutation",
        name: "post",
      },
      apispec: {},
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
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
        query: undefined,
        auth: undefined,
      },
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
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
        auth: undefined,
      },
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
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
        auth: undefined,
      },
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
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
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
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
        auth: undefined,
      },
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
        body: undefined,
        query: undefined,
        auth: [{ type: "http", scheme: "bearer" }],
      },
      graphQLSchema: undefined,
    },
    {
      method: "GET",
      path: "/auth2",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
        body: undefined,
        query: undefined,
        auth: [{ type: "apiKey", in: "cookie", name: "session" }],
      },
      graphQLSchema: undefined,
    },
    {
      method: "GET",
      path: "/auth3",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
        body: undefined,
        query: undefined,
        auth: [{ type: "apiKey", in: "header", name: "x-api-key" }],
      },
      graphQLSchema: undefined,
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
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
        auth: [
          { type: "http", scheme: "bearer" },
          { type: "http", scheme: "basic" },
          { type: "apiKey", in: "header", name: "x-api-key" },
        ],
      },
      graphQLSchema: undefined,
    },
  ]);
});

t.test("it ignores empty body objects", async (t) => {
  const routes = new Routes(200);
  routes.addRoute(getContext("GET", "/empty", {}, {}, {}, {}));
  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/empty",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
  ]);
});

t.test("it ignores body of graphql queries", async (t) => {
  const routes = new Routes(200);
  routes.addRoute({
    ...getContext(
      "POST",
      "/graphql",
      {
        "content-type": "application/json",
        "x-api-key": "123",
      },
      {
        query: "query { user { name } }",
      },
      {},
      {}
    ),
    ...{
      graphql: ["name"],
    },
  });
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
        body: undefined,
        query: undefined,
        auth: [{ type: "apiKey", in: "header", name: "x-api-key" }],
      },
      graphQLSchema: undefined,
    },
  ]);
});

t.test("it respects max samples", async (t) => {
  const routes = new Routes(200);
  for (let i = 0; i < 12; i++) {
    const body: Record<string, unknown> = {};
    body[`test${i}`] = i;
    routes.addRoute(
      getContext(
        "POST",
        "/add",
        {
          "content-type": "application/json",
        },
        body
      )
    );
  }

  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/add",
      hits: 12,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
        body: {
          type: "json",
          schema: {
            type: "object",
            properties: {
              test0: {
                type: "number",
                optional: true,
              },
              test1: {
                type: "number",
                optional: true,
              },
              test2: {
                type: "number",
                optional: true,
              },
              test3: {
                type: "number",
                optional: true,
              },
              test4: {
                type: "number",
                optional: true,
              },
              test5: {
                type: "number",
                optional: true,
              },
              test6: {
                type: "number",
                optional: true,
              },
              test7: {
                type: "number",
                optional: true,
              },
              test8: {
                type: "number",
                optional: true,
              },
              test9: {
                type: "number",
                optional: true,
              },
              test10: {
                type: "number",
                optional: true,
              },
            },
          },
        },
        query: undefined,
        auth: undefined,
      },
      graphQLSchema: undefined,
    },
  ]);
});

t.test(
  "it allows setting AIKIDO_MAX_API_DISCOVERY_SAMPLES to zero (does not sample any requests)",
  async (t) => {
    process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES = "0";
    const routes = new Routes(200);
    for (let i = 0; i < 12; i++) {
      const body: Record<string, unknown> = {};
      body[`test${i}`] = i;
      routes.addRoute(
        getContext(
          "POST",
          "/add",
          {
            "content-type": "application/json",
          },
          body
        )
      );
    }

    t.same(routes.asArray(), [
      {
        method: "POST",
        path: "/add",
        hits: 12,
        rateLimitedCount: 0,
        graphql: undefined,
        apispec: {},
        graphQLSchema: undefined,
      },
    ]);
  }
);

t.test("with string format", async (t) => {
  const routes = new Routes(200);
  routes.addRoute(
    getContext(
      "POST",
      "/body",
      { "content-type": "application/json" },
      { email: "test@example.com" }
    )
  );

  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/body",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {
        body: {
          type: "json",
          schema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                format: "email",
              },
            },
          },
        },
        query: undefined,
        auth: undefined,
      },
      graphQLSchema: undefined,
    },
  ]);
});

t.test(
  "it does not collect routes or samples if request comes from aikido DAST",
  async (t) => {
    const routes = new Routes(200);
    routes.addRoute(
      getContext(
        "POST",
        "/body",
        { "aikido-api-test": "1", "content-type": "application/json" },
        { test: "abc" }
      )
    );

    t.same(routes.asArray(), []);

    routes.addRoute(
      getContext(
        "POST",
        "/body",
        { "aikido-api-test": "0", "content-type": "application/json" },
        { test: "abc" }
      )
    );
    t.same(routes.asArray(), [
      {
        method: "POST",
        path: "/body",
        hits: 1,
        rateLimitedCount: 0,
        graphql: undefined,
        apispec: {
          body: {
            type: "json",
            schema: {
              type: "object",
              properties: {
                test: {
                  type: "string",
                },
              },
            },
          },
          query: undefined,
          auth: undefined,
        },
        graphQLSchema: undefined,
      },
    ]);

    routes.addRoute(
      getContext(
        "POST",
        "/body",
        { "content-type": "application/json" },
        { test: "abc" }
      )
    );
    t.same(routes.asArray(), [
      {
        method: "POST",
        path: "/body",
        hits: 2,
        rateLimitedCount: 0,
        graphql: undefined,
        apispec: {
          body: {
            type: "json",
            schema: {
              type: "object",
              properties: {
                test: {
                  type: "string",
                },
              },
            },
          },
          query: undefined,
          auth: undefined,
        },
        graphQLSchema: undefined,
      },
    ]);
  }
);

t.test("it counts rate limited requests", async (t) => {
  const routes = new Routes(200);

  routes.countRouteRateLimited({
    method: "GET",
    route: "/api/foo",
    forceProtectionOff: false,
    allowedIPAddresses: undefined,
    rateLimiting: {
      enabled: false,
      maxRequests: 0,
      windowSizeInMS: 0,
    },
  });

  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/api/foo",
      hits: 0,
      rateLimitedCount: 1,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
  ]);

  routes.addRoute(getContext("POST", "/api/foo"));

  routes.countRouteRateLimited({
    method: "POST",
    route: "/api/foo",
    forceProtectionOff: false,
    allowedIPAddresses: undefined,
    rateLimiting: {
      enabled: false,
      maxRequests: 0,
      windowSizeInMS: 0,
    },
  });

  t.same(routes.asArray(), [
    {
      method: "GET",
      path: "/api/foo",
      hits: 0,
      rateLimitedCount: 1,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/api/foo",
      hits: 1,
      rateLimitedCount: 1,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
  ]);
});

t.test("it counts rate limited GraphQL fields", async (t) => {
  const routes = new Routes(200);
  routes.addRoute(getContext("POST", "/graphql"));
  routes.addGraphQLField("POST", "/graphql", "query", "user");

  routes.countRouteRateLimited({
    method: "POST",
    route: "/graphql",
    graphql: { type: "query", name: "user" },
    forceProtectionOff: false,
    allowedIPAddresses: undefined,
    rateLimiting: {
      enabled: false,
      maxRequests: 0,
      windowSizeInMS: 0,
    },
  });

  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 1,
      graphql: { type: "query", name: "user" },
      apispec: {},
      graphQLSchema: undefined,
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "query", "user");
  routes.countRouteRateLimited({
    method: "POST",
    route: "/graphql",
    graphql: { type: "query", name: "user" },
    forceProtectionOff: false,
    allowedIPAddresses: undefined,
    rateLimiting: {
      enabled: true,
      maxRequests: 2,
      windowSizeInMS: 1000,
    },
  });

  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      rateLimitedCount: 0,
      graphql: undefined,
      apispec: {},
      graphQLSchema: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      rateLimitedCount: 2,
      graphql: { type: "query", name: "user" },
      apispec: {},
      graphQLSchema: undefined,
    },
  ]);
});
