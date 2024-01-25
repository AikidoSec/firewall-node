import * as t from "tap";
import { detectNoSQLInjection } from "./detectNoSQLInjection";
import { Request } from "./RequestContext";

function createContext({
  query,
  headers,
  body,
}: {
  query?: Request["query"];
  body?: Request["body"];
  headers?: Request["headers"];
}): Request {
  return {
    remoteAddress: "::1",
    method: "GET",
    url: "http://localhost:4000",
    query: query,
    headers: headers,
    body: body,
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

  t.end();
});
