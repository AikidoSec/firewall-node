import * as t from "tap";
import { detectNoSQLInjection } from "./detectNoSQLInjection";
import { Request } from "./RequestContext";

function createContext({
  query,
  headers,
  body,
  cookies,
}: {
  query?: Request["query"];
  body?: Request["body"];
  headers?: Request["headers"];
  cookies?: Request["cookies"];
}): Request {
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

t.test("detectInjection", (t) => {
  t.match(detectNoSQLInjection(createContext({}), {}), { injection: false });

  t.match(
    detectNoSQLInjection(createContext({}), {
      title: { title: "title" },
    }),
    { injection: false }
  );

  t.match(
    detectNoSQLInjection(createContext({}), {
      title: { $ne: null },
    }),
    { injection: false }
  );

  t.match(
    detectNoSQLInjection(
      createContext({
        query: { title: { $ne: null } },
      }),
      {
        title: { $ne: null },
      }
    ),
    { injection: true, source: "query" }
  );

  t.match(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        title: { $ne: null },
      }
    ),
    { injection: true, source: "body" }
  );

  t.match(
    detectNoSQLInjection(
      createContext({
        body: { title: { $ne: null } },
      }),
      {
        someField: { $ne: null },
      }
    ),
    { injection: true, source: "body" }
  );

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
    { injection: true, source: "body" }
  );

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
    { injection: true, source: "body" }
  );

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
    { injection: true, source: "body" }
  );

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
    { injection: true, source: "body" }
  );

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
    { injection: true, source: "body" }
  );

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
    { injection: true, source: "headers" }
  );

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
    { injection: true, source: "headers" }
  );

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
    { injection: true, source: "cookies" }
  );

  t.end();
});
