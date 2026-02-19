import * as t from "tap";
import { detectNoSQLInjection } from "./detectNoSQLInjection";
import { Context } from "../../agent/Context";

function createContext({
  query,
  headers,
  body,
  cookies,
  routeParams,
}: {
  query?: Context["query"];
  body?: Context["body"];
  headers?: Context["headers"];
  cookies?: Context["cookies"];
  routeParams?: Context["routeParams"];
}): Context {
  return {
    remoteAddress: "::1",
    method: "GET",
    url: "http://localhost:4000",
    query: query ? query : {},
    headers: headers ? headers : {},
    body: body,
    cookies: cookies ? cookies : {},
    routeParams: routeParams ? routeParams : {},
    source: "express",
    route: "/posts/:id",
  };
}

t.test("empty filter and request", async (t) => {
  t.same(detectNoSQLInjection(createContext({}), {}), {
    injection: false,
  });
});

t.test("ignores if filter is not an object", async (t) => {
  t.same(detectNoSQLInjection(createContext({}), "abc"), {
    injection: false,
  });
});

t.test("ignores if $and is not an array", async (t) => {
  t.same(detectNoSQLInjection(createContext({}), { $and: "abc" }), {
    injection: false,
  });
});

t.test("ignores if $or is not an array", async (t) => {
  t.same(detectNoSQLInjection(createContext({}), { $or: "abc" }), {
    injection: false,
  });
});

t.test("ignores if $nor is not an array", async (t) => {
  t.same(detectNoSQLInjection(createContext({}), { $nor: "abc" }), {
    injection: false,
  });
});

t.test("ignores if $nor an empty array", async (t) => {
  t.same(detectNoSQLInjection(createContext({}), { $nor: [] }), {
    injection: false,
  });
});

t.test("ignores if $not not an object", async (t) => {
  t.same(detectNoSQLInjection(createContext({}), { $not: "abc" }), {
    injection: false,
  });
});

t.test("filter with string value and empty request", async (t) => {
  t.same(
    detectNoSQLInjection(createContext({}), {
      title: { title: "title" },
    }),
    { injection: false }
  );
});

t.test("filter with $ne and empty request", async (t) => {
  t.same(
    detectNoSQLInjection(createContext({}), {
      title: { $ne: null },
    }),
    { injection: false }
  );
});

t.test("using $gt in query parameter", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        query: { title: { $gt: "" } },
      }),
      {
        title: { $gt: "" },
      }
    ),
    {
      injection: true,
      source: "query",
      pathsToPayload: [".title"],
      payload: { $gt: "" },
    }
  );
});

t.test("Safe filter", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        query: { title: "title" },
      }),
      {
        $and: [{ title: "title" }],
      }
    ),
    { injection: false }
  );
});

t.test("using $ne in body", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        title: { $ne: null },
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".title"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne in body (different name)", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        myTitle: { $ne: null },
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".title"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne in headers with different name", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        someField: { $ne: null },
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".title"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne inside $and", async (t) => {
  t.same(
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
    {
      injection: true,
      source: "body",
      pathsToPayload: [".title"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne inside $or", async (t) => {
  t.same(
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
    {
      injection: true,
      source: "body",
      pathsToPayload: [".title"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne inside $nor", async (t) => {
  t.same(
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
    {
      injection: true,
      source: "body",
      pathsToPayload: [".title"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne inside $not", async (t) => {
  t.same(
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
    {
      injection: true,
      source: "body",
      pathsToPayload: [".title"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne nested in body", async (t) => {
  t.same(
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
      pathsToPayload: [".nested.nested"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne in JWT in headers", async (t) => {
  t.same(
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
      pathsToPayload: [".Authorization<jwt>.username"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne in JWT in bearer header", async (t) => {
  t.same(
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
      pathsToPayload: [".Authorization<jwt>.username"],
      payload: { $ne: null },
    }
  );
});

t.test("using $ne in JWT in cookies", async (t) => {
  t.same(
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
      pathsToPayload: [".session<jwt>.username"],
      payload: { $ne: null },
    }
  );
});

t.test("JWT lookalike", async (t) => {
  t.same(
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

t.test("using $gt in query parameter", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        query: { age: { $gt: "21" } },
      }),
      {
        age: { $gt: "21" },
      }
    ),
    {
      injection: true,
      source: "query",
      pathsToPayload: [".age"],
      payload: { $gt: "21" },
    }
  );
});

t.test("using $gt and $lt in query parameter", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: { age: { $gt: "21", $lt: "100" } },
      }),
      {
        age: { $gt: "21", $lt: "100" },
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".age"],
      payload: { $gt: "21", $lt: "100" },
    }
  );
});

t.test("using $gt and $lt in query parameter (different name)", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: { age: { $gt: "21", $lt: "100" } },
      }),
      {
        myAge: { $gt: "21", $lt: "100" },
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".age"],
      payload: { $gt: "21", $lt: "100" },
    }
  );
});

t.test("using $gt and $lt in query parameter (nested)", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: {
          nested: {
            nested: { age: { $gt: "21", $lt: "100" } },
          },
        },
      }),
      {
        $and: [
          {
            someAgeField: { $gt: "21", $lt: "100" },
          },
        ],
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".nested.nested.age"],
      payload: { $gt: "21", $lt: "100" },
    }
  );
});

t.test("using $gt and $lt in query parameter (root)", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: {
          $and: [
            {
              someAgeField: { $gt: "21", $lt: "100" },
            },
          ],
        },
      }),
      {
        $and: [
          {
            someAgeField: { $gt: "21", $lt: "100" },
          },
        ],
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: ["."],
      payload: { $and: [{ someAgeField: { $gt: "21", $lt: "100" } }] },
    }
  );
});

t.test("$where", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: {
          $and: [
            {
              $where: "sleep(1000)",
            },
          ],
        },
      }),
      {
        $and: [
          {
            $where: "sleep(1000)",
          },
        ],
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: ["."],
      payload: {
        $and: [
          {
            $where: "sleep(1000)",
          },
        ],
      },
    }
  );
});

t.test("array body", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: [
          {
            $where: "sleep(1000)",
          },
        ],
      }),
      {
        $and: [
          {
            $where: "sleep(1000)",
          },
        ],
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".[0]"],
      payload: { $where: "sleep(1000)" },
    }
  );
});

t.test("safe email + password", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: {
          email: "email",
          password: "password",
        },
      }),
      {
        email: "email",
        password: "password",
      }
    ),
    { injection: false }
  );
});

t.test("it checks route params", async () => {
  t.same(
    detectNoSQLInjection(
      createContext({
        routeParams: { id: "123" },
      }),
      {
        id: "123",
      }
    ),
    { injection: false }
  );
});

t.test("it flags pipeline aggregations", async () => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: [
          {
            $lookup: {
              from: "users",
              localField: "Dummy-IdontExist",
              foreignField: "Dummy-IdontExist",
              as: "user_docs",
            },
          },
          {
            $limit: 1,
          },
        ],
      }),
      [
        {
          $lookup: {
            from: "users",
            localField: "Dummy-IdontExist",
            foreignField: "Dummy-IdontExist",
            as: "user_docs",
          },
        },
        {
          $limit: 1,
        },
      ]
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".[0]"],
      payload: {
        $lookup: {
          from: "users",
          localField: "Dummy-IdontExist",
          foreignField: "Dummy-IdontExist",
          as: "user_docs",
        },
      },
    }
  );

  t.same(
    detectNoSQLInjection(
      createContext({
        body: {
          username: {
            $gt: "",
          },
        },
      }),
      [
        {
          $match: {
            username: {
              $gt: "",
            },
          },
        },
        {
          $group: {
            _id: "$username",
            count: { $sum: 1 },
          },
        },
      ]
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".username"],
      payload: {
        $gt: "",
      },
    }
  );
});

t.test("it ignores safe pipeline aggregations", async () => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: {
          username: "admin",
        },
      }),
      [
        {
          $match: {
            username: "admin",
          },
        },
        {
          $group: {
            _id: "$username",
            count: { $sum: 1 },
          },
        },
      ]
    ),
    {
      injection: false,
    }
  );
});

t.test("detects root injection", async () => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: {
          username: "admin",
          $where: "test",
        },
      }),
      { username: "admin", $where: "test" }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: ["."],
      payload: { $where: "test" },
    }
  );
});

t.test("detects injection", async () => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: {
          username: "admin",
          test: { $ne: "", hello: "world" },
        },
      }),
      { username: "admin", test: { $ne: "", hello: "world" } }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".test"],
      payload: { $ne: "" },
    }
  );
});

t.test("it does not detect", async () => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: {
          username: "admin",
          password: "test",
        },
      }),
      { username: "admin", password: "test" }
    ),
    {
      injection: false,
    }
  );
});

t.test("$where js inject sleep", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: { name: "a' && sleep(2000) && 'b" },
      }),
      {
        $where: "this.name === 'a' && sleep(2000) && 'b'",
      }
    ),
    {
      injection: true,
      source: "body",
      pathsToPayload: [".name"],
      payload: { $where: "this.name === 'a' && sleep(2000) && 'b'" },
    }
  );
});

t.test("does not detect if not a string (js injection)", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        body: { test: 123 },
      }),
      {
        $where: "this.name === 123",
      }
    ),
    {
      injection: false,
    }
  );
});

t.test("$where js inject with array in request", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        query: { name: ["a' /*", "*/ && sleep(2000) && 'b"] },
      }),
      {
        $where: "this.name === 'a' /*,*/ && sleep(2000) && 'b'",
      }
    ),
    {
      injection: true,
      source: "query",
      pathsToPayload: [".name"],
      payload: { $where: "this.name === 'a' /*,*/ && sleep(2000) && 'b'" },
    }
  );
});

t.test("$where js inject with array in request in nested field", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        query: { name: ["a' /*", "*/ && sleep(2000) && 'b"] },
      }),
      {
        test: {
          $where: "this.name === 'a' /*,*/ && sleep(2000) && 'b'",
        },
      }
    ),
    {
      injection: true,
      source: "query",
      pathsToPayload: [".name"],
      payload: { $where: "this.name === 'a' /*,*/ && sleep(2000) && 'b'" },
    }
  );
});

t.test("not a valid injection attempt", async (t) => {
  t.same(
    detectNoSQLInjection(
      createContext({
        query: { name: ["a'", " && sleep(2000) && 'b"] },
      }),
      {
        $where: "this.name === 'a' && sleep(2000) && 'b'",
      }
    ),
    {
      injection: false,
    }
  );
});
