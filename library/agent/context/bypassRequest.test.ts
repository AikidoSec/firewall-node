import * as t from "tap";
import { wrap } from "../../helpers/wrap";
import { type Context, getContext, runWithContext } from "../Context";
import { bypassRequest } from "./bypassRequest";
import { createTestAgent } from "../../helpers/createTestAgent";

function createContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: {},
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

t.beforeEach(() => {
  createTestAgent();
});

t.test("usage outside of context", async (t) => {
  let logs: string[] = [];
  wrap(console, "warn", function warn() {
    return function warn(message: string) {
      logs.push(message);
    };
  });

  bypassRequest();

  t.same(logs, [
    "bypassRequest(...) was called without a context. The request will not be bypassed. Make sure to call bypassRequest(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports).",
  ]);

  // Should not log again
  logs = [];
  bypassRequest();
  t.same(logs, []);
});

t.test("it updates the context to bypass the request", async (t) => {
  const context = createContext();

  runWithContext(context, () => {
    t.same(getContext()?.bypassRequest, undefined);
    bypassRequest();
    t.same(getContext()?.bypassRequest, true);
  });
});
