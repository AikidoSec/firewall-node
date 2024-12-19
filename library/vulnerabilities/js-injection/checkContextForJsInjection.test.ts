import * as t from "tap";
import { checkContextForJsInjection } from "./checkContextForJsInjection";

t.test("it returns correct path", async () => {
  t.same(
    checkContextForJsInjection({
      js: "const x = 1 + 1; fetch();",
      operation: "eval",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {},
        body: {
          calc: "1 + 1; fetch()",
        },
        source: "express",
        route: "/",
        routeParams: {},
      },
    }),
    {
      operation: "eval",
      kind: "js_injection",
      source: "body",
      pathsToPayload: [".calc"],
      metadata: {
        js: "const x = 1 + 1; fetch();",
      },
      payload: "1 + 1; fetch()",
    }
  );
});
