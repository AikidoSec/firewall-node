import * as t from "tap";
import { detectNoSQLInjection } from "./detectNoSQLInjection";
import { Context } from "../agent/Context";

function createContext({
  query,
  headers,
  body,
  cookies,
}: {
  query?: Context["query"];
  body?: Context["body"];
  headers?: Context["headers"];
  cookies?: Context["cookies"];
}): Context {
  return {
    remoteAddress: "::1",
    method: "GET",
    url: "http://localhost:4000",
    query: query,
    headers: headers,
    body: body,
    cookies: cookies,
  };
}

t.test("empty filter and request", async (t) => {
  t.match(detectNoSQLInjection(createContext({}), {}), { injection: false });
});

t.test("ignores if filter is not an object", async (t) => {
  t.match(detectNoSQLInjection(createContext({}), "abc"), { injection: false });
});

t.test("ignores if $and is not an array", async (t) => {
  t.match(detectNoSQLInjection(createContext({}), { $and: "abc" }), {
    injection: false,
  });
});

t.test("ignores if $or is not an array", async (t) => {
  t.match(detectNoSQLInjection(createContext({}), { $or: "abc" }), {
    injection: false,
  });
});

t.test("ignores if $nor is not an array", async (t) => {
  t.match(detectNoSQLInjection(createContext({}), { $nor: "abc" }), {
    injection: false,
  });
});

t.test("ignores if $nor an empty array", async (t) => {
  t.match(detectNoSQLInjection(createContext({}), { $nor: [] }), {
    injection: false,
  });
});

t.test("ignores if $not not an object", async (t) => {
  t.match(detectNoSQLInjection(createContext({}), { $not: "abc" }), {
    injection: false,
  });
});

t.test("filter with string value and empty request", async (t) => {
  t.match(
    detectNoSQLInjection(createContext({}), {
      title: { title: "title" },
    }),
    { injection: false }
  );
});

t.test("filter with $ne and empty request", async (t) => {
  t.match(
    detectNoSQLInjection(createContext({}), {
      title: { $ne: null },
    }),
    { injection: false }
  );
});

t.test("NoSQL injection using $ne in query parameter", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        query: { title: { $ne: null } },
      }),
      {
        title: { $ne: null },
      }
    ),
    { injection: true, source: "query", path: "title" }
  );
});

t.test("NoSQL injection using $ne in body", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        title: { $ne: null },
      }
    ),
    { injection: true, source: "body", path: ".title" }
  );
});

t.test(
  "NoSQL injection using $ne in headers with different name",
  async (t) => {
    t.match(
      detectNoSQLInjection(
        createContext({
          body: { title: { $ne: null } },
        }),
        {
          someField: { $ne: null },
        }
      ),
      { injection: true, source: "body", path: ".title" }
    );
  }
);

t.test("NoSQL injection using $ne inside $and", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        $and: [
          {
            title: { $ne: null },
          },
          {
            published: true,
          },
        ],
      }
    ),
    { injection: true, source: "body", path: ".title" }
  );
});

t.test("NoSQL injection using $ne inside $or", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        $or: [
          {
            title: { $ne: null },
          },
          {
            published: true,
          },
        ],
      }
    ),
    { injection: true, source: "body", path: ".title" }
  );
});

t.test("NoSQL injection using $ne inside $nor", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        $nor: [
          {
            title: { $ne: null },
          },
          {
            published: true,
          },
        ],
      }
    ),
    { injection: true, source: "body", path: ".title" }
  );
});

t.test("NoSQL injection using $ne inside $not", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        $not: {
          title: { $ne: null },
        },
      }
    ),
    { injection: true, source: "body", path: ".title" }
  );
});

t.test("NoSQL injection using $ne nested in body", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        body: { nested: { nested: { $ne: null } } },
      }),
      {
        $not: {
          title: { $ne: null },
        },
      }
    ),
    {
      injection: true,
      source: "body",
      path: ".nested",
    }
  );
});

t.test("NoSQL injection using $ne in JWT in headers", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        headers: {
          /**
           * JWT token with the following payload:
           * {
           *   "sub": "1234567890",
           *   "username": {
           *     "$ne": null
           *   },
           *   "iat": 1516239022
           * }
           */
          Authorization:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOnsiJG5lIjpudWxsfSwiaWF0IjoxNTE2MjM5MDIyfQ._jhGJw9WzB6gHKPSozTFHDo9NOHs3CNOlvJ8rWy6VrQ",
        },
      }),
      {
        username: { $ne: null },
      }
    ),
    {
      injection: true,
      source: "headers",
      path: "Authorization",
    }
  );
});

t.test("NoSQL injection using $ne in JWT in bearer header", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        headers: {
          /**
           * JWT token with the following payload:
           * {
           *   "sub": "1234567890",
           *   "username": {
           *     "$ne": null
           *   },
           *   "iat": 1516239022
           * }
           */
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOnsiJG5lIjpudWxsfSwiaWF0IjoxNTE2MjM5MDIyfQ._jhGJw9WzB6gHKPSozTFHDo9NOHs3CNOlvJ8rWy6VrQ",
        },
      }),
      {
        username: { $ne: null },
      }
    ),
    {
      injection: true,
      source: "headers",
      path: "Authorization",
    }
  );
});

t.test("NoSQL injection using $ne in JWT in cookies", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        cookies: {
          /**
           * JWT token with the following payload:
           * {
           *   "sub": "1234567890",
           *   "username": {
           *     "$ne": null
           *   },
           *   "iat": 1516239022
           * }
           */
          session:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOnsiJG5lIjpudWxsfSwiaWF0IjoxNTE2MjM5MDIyfQ._jhGJw9WzB6gHKPSozTFHDo9NOHs3CNOlvJ8rWy6VrQ",
        },
      }),
      {
        username: { $ne: null },
      }
    ),
    {
      injection: true,
      source: "cookies",
      path: "session",
    }
  );
});

t.test("JWT lookalike", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        cookies: {
          session:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbW!iOnsiJG5lIjpudWxsfSwiaWF0IjoxNTE2MjM5MDIyfQ._jhGJw9WzB6gHKPSozTFHDo9NOHs3CNOlvJ8rWy6VrQ",
        },
      }),
      {
        username: { $ne: null },
      }
    ),
    {
      injection: false,
    }
  );
});

t.test("NoSQL injection using $gt in query parameter", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        query: { age: { $gt: "21" } },
      }),
      {
        age: { $gt: "21" },
      }
    ),
    { injection: true, source: "query", path: "age" }
  );
});

/*t.test("NoSQL injection using $gt in query parameter", async (t) => {
  t.match(
    detectNoSQLInjection(
      createContext({
        body: { age: { $gt: "21", $lt: "100" } },
      }),
      {
        age: { $gt: "21", $lt: "100" },
      }
    ),
    { injection: true, source: "body", path: ".age" }
  );
});*/
