import * as t from "tap";
import { Request } from "../RequestContext";
import { detectInjection } from "./MongoDB";

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
  t.match(detectInjection(createContext({}), {}), { injection: false });

  t.match(
    detectInjection(createContext({}), {
      title: { title: "title" },
    }),
    { injection: false }
  );

  t.match(
    detectInjection(createContext({}), {
      title: { $ne: null },
    }),
    { injection: false }
  );

  t.match(
    detectInjection(
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
    detectInjection(
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
    detectInjection(
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
    detectInjection(
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
    detectInjection(
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
    detectInjection(
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
    detectInjection(
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

  t.end();
});
