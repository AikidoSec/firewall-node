import * as t from "tap";
import { wrap } from "../helpers/wrap";
import {
  type Context,
  getContext,
  runWithContext,
  updateContext,
} from "../agent/Context";
import { LoggerForTesting } from "../agent/logger/LoggerForTesting";
import { setRateLimitGroup } from "./group";
import { createTestAgent } from "../helpers/createTestAgent";

function createContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: {
      myTitle: `-- should be blocked`,
    },
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

  setRateLimitGroup({ id: "id" });

  t.same(logs, [
    "setRateLimitGroup(...) was called without a context. Make sure to call setRateLimitGroup(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports).",
  ]);

  // Should not log again
  logs = [];
  setRateLimitGroup({ id: "id" });
  t.same(logs, []);
});

t.test("it does not set group if empty id", async (t) => {
  const context = createContext();

  runWithContext(context, () => {
    setRateLimitGroup({ id: "" });
    t.same(getContext()?.rateLimitGroup, undefined);
  });
});

t.test("it does not set group if not inside context", async () => {
  setRateLimitGroup({ id: "id" });
});

t.test("it sets group", async (t) => {
  const context = createContext();

  runWithContext(context, () => {
    setRateLimitGroup({ id: "id" });
    t.same(getContext()?.rateLimitGroup, "id");
  });
});

t.test("it sets group with number as ID", async (t) => {
  const context = createContext();

  runWithContext(context, () => {
    setRateLimitGroup({ id: 1 });
    t.same(getContext()?.rateLimitGroup, "1");
  });
});

t.test("it logs when setRateLimitGroup has invalid input", async () => {
  const logger = new LoggerForTesting();
  createTestAgent({ logger });

  const context = createContext();

  runWithContext(context, () => {
    // @ts-expect-error Group should be an object
    setRateLimitGroup(1);
    t.same(logger.getMessages(), [
      "setRateLimitGroup(...) expects an object with 'id' properties, found number instead.",
    ]);
    logger.clear();

    // @ts-expect-error ID should be string or number
    setRateLimitGroup({ id: {} });
    t.same(logger.getMessages(), [
      "setRateLimitGroup(...) expects an object with 'id' property of type string or number, found object instead.",
    ]);
    logger.clear();

    setRateLimitGroup({ id: "" });
    t.same(logger.getMessages(), [
      "setRateLimitGroup(...) expects an object with 'id' property non-empty string.",
    ]);
    logger.clear();

    // @ts-expect-error ID is missing
    setRateLimitGroup({});
    t.same(logger.getMessages(), [
      "setRateLimitGroup(...) expects an object with 'id' property.",
    ]);
    logger.clear();
  });
});

t.test(
  "it does not log warning when setRateLimitGroup is called before middleware",
  async () => {
    const logs: string[] = [];
    wrap(console, "warn", function warn() {
      return function warn(message: string) {
        logs.push(message);
      };
    });

    const context = createContext();
    runWithContext(context, () => {
      setRateLimitGroup({ id: "id" });
    });

    t.same(logs, []);
  }
);

t.test(
  "it logs warning when setRateLimitGroup is called after middleware (once)",
  async () => {
    const logs: string[] = [];
    wrap(console, "warn", function warn() {
      return function warn(message: string) {
        logs.push(message);
      };
    });

    const context = createContext();
    runWithContext(context, () => {
      updateContext(getContext()!, "executedMiddleware", true);
      setRateLimitGroup({ id: "id" });
      setRateLimitGroup({ id: "id" });
    });

    t.same(logs, [
      "setRateLimitGroup(...) must be called before the Zen middleware is executed.",
    ]);
  }
);
