import * as t from "tap";
import { shouldBlockRequest } from "./shouldBlockRequest";
import { runWithContext, type Context } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { wrap } from "../helpers/wrap";

const sampleContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {
    abc: "def",
  },
  headers: {},
  body: undefined,
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("without context", async (t) => {
  const logs: string[] = [];
  wrap(console, "warn", function warn() {
    return function warn(message: string) {
      logs.push(message);
    };
  });

  const result = shouldBlockRequest();
  t.same(result, { block: false });
  t.same(logs, [
    "shouldBlockRequest() was called without a context. The request will not be blocked. Make sure to call shouldBlockRequest() within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen.",
  ]);
});

t.test("without agent", async (t) => {
  runWithContext(sampleContext, () => {
    t.same(shouldBlockRequest(), { block: false });
  });
});

t.test("with agent", async (t) => {
  createTestAgent();
  runWithContext(sampleContext, () => {
    t.same(shouldBlockRequest(), { block: false });
  });
});
