import * as t from "tap";
import { startTestAgent } from "../helpers/startTestAgent";
import { runWithContext, type Context } from "../agent/Context";

t.before(async () => {
  startTestAgent({
    block: true,
    wrappers: [],
    rewrite: {},
  });
});

function getTestContext(testStr: string): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000/api/test",
    query: {},
    headers: {
      "content-type": "application/json",
    },
    body: {
      test: testStr,
    },
    cookies: {},
    routeParams: {},
    source: "hono",
    route: "/api/test",
  };
}

t.test("it works", async (t) => {
  await import("http");
  require("http2");

  runWithContext(getTestContext("child_process"), () => {
    const error = t.throws(() => {
      require("child_process");
    });

    t.match(error, {
      message:
        "Zen has blocked an insecure import: import/require(...) originating from body.test",
    });
  });
});
