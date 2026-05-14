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

t.test(
  "deeply nested array in body does not cause a stack overflow",
  { timeout: 30 * 1000 },
  async (t) => {
    let deepNested: unknown = ["x", "y"];
    for (let i = 0; i < 4000; i++) {
      deepNested = [deepNested, "z"];
    }

    const ctx = createContext({
      body: { nested: deepNested, username: { $ne: null } },
    });
    const filter = { username: { $ne: null } };

    detectNoSQLInjection(ctx, filter);
    t.same(detectNoSQLInjection(ctx, filter), {
      injection: true,
      source: "body",
      pathsToPayload: [".username"],
      payload: { $ne: null },
    });
  }
);
