import * as t from "tap";
import { Context } from "../../agent/Context";
import { isGraphQLOverHTTP } from "./isGraphQLOverHTTP";

function createContext({
  method = "GET",
  query = {},
  headers = {},
  body = undefined,
  path = "/graphql",
}: {
  method?: string;
  path?: string;
  query?: Context["query"];
  body?: Context["body"];
  headers?: Context["headers"];
}): Context {
  return {
    remoteAddress: "::1",
    method: method,
    url: `https://app.domain.com${path}`,
    query: query ? query : {},
    headers: headers ? headers : {},
    body: body,
    cookies: {},
    routeParams: {},
    source: "express",
    route: path,
  };
}

t.test("GET request with valid GraphQL query", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "GET",
        query: { query: "{ field }" },
      })
    ),
    true
  );
});

t.test("GET request with missing query", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "GET",
        query: {},
      })
    ),
    false
  );
});

t.test("GET request with non-GraphQL route", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "GET",
        path: "/not-graphql",
        query: { query: "{ field }" },
      })
    ),
    false
  );
});

t.test("POST request with valid headers and body", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: { query: "{ field }" },
      })
    ),
    true
  );
});

t.test("POST request with invalid content-type", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: { query: "{ field }" },
      })
    ),
    false
  );
});

t.test("POST request with invalid body structure", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: { notQuery: "{ field }" },
      })
    ),
    false
  );
});

t.test("POST request with non-GraphQL route", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "POST",
        path: "/not-graphql",
        headers: { "content-type": "application/json" },
        body: { query: "{ field }" },
      })
    ),
    false
  );
});

t.test("GET request with versioned GraphQL endpoint", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "GET",
        path: "/graphql/v1",
        query: { query: "{ field }" },
      })
    ),
    false
  );
});

t.test("POST request with versioned GraphQL endpoint", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "POST",
        path: "/graphql/v1",
        headers: { "content-type": "application/json" },
        body: { query: "{ field }" },
      })
    ),
    false
  );
});

t.test(
  "GET request with query that doesn't include curly braces",
  async (t) => {
    t.same(
      isGraphQLOverHTTP(
        createContext({
          method: "GET",
          query: { query: "query without braces" },
        })
      ),
      false
    );
  }
);

t.test(
  "POST request with query that doesn't include curly braces",
  async (t) => {
    t.same(
      isGraphQLOverHTTP(
        createContext({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: { query: "mutation without braces" },
        })
      ),
      false
    );
  }
);

t.test("Random request with no relation to GraphQL", async (t) => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "POST",
        path: "/api/some-other-endpoint",
        headers: { "content-type": "application/json" },
        body: { data: "some data" },
      })
    ),
    false
  );
});

t.test("Context without URL", async () => {
  t.same(isGraphQLOverHTTP({} as Context), false);
});

t.test("Context with PUT method", async () => {
  t.same(
    isGraphQLOverHTTP(
      createContext({
        method: "PUT",
        body: { query: "{ field }" },
      })
    ),
    false
  );
});
