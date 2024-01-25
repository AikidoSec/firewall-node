import t from "tap";
import { Aikido } from "../Aikido";
import { RequestContext } from "../requestContext";
import { detectInjection } from "./MongoDB";

function createContext({
  query,
  headers,
  body,
}: {
  query?: RequestContext["request"]["query"];
  body?: RequestContext["request"]["body"];
  headers?: RequestContext["request"]["headers"];
}): RequestContext {
  return {
    aikido: new Aikido(),
    request: {
      remoteAddress: "::1",
      method: "GET",
      url: "http://localhost:3000",
      query: query,
      headers: headers,
      body: body,
    },
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

  t.end();
});
