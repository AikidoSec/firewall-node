import * as t from "tap";
import { wrap } from "../../helpers/wrap";
import {
  type Context,
  getContext,
  runWithContext,
  updateContext,
} from "../Context";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { setUser } from "./user";
import { createTestAgent } from "../../helpers/createTestAgent";

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

  setUser({ id: "id" });

  t.same(logs, [
    "setUser(...) was called without a context. The user will not be tracked. Make sure to call setUser(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports).",
  ]);

  // Should not log again
  logs = [];
  setUser({ id: "id" });
  t.same(logs, []);
});

t.test("it does not set user if empty id", async (t) => {
  const context = createContext();

  runWithContext(context, () => {
    setUser({ id: "" });
    t.same(getContext()?.user, undefined);
  });
});

t.test("it does not set user if not inside context", async () => {
  setUser({ id: "id" });
});

t.test("it sets user", async (t) => {
  const context = createContext();

  runWithContext(context, () => {
    setUser({ id: "id" });
    t.same(getContext()?.user, {
      id: "id",
    });
  });
});

t.test("it sets user with number as ID", async (t) => {
  const context = createContext();

  runWithContext(context, () => {
    setUser({ id: 1 });
    t.same(getContext()?.user, {
      id: "1",
    });
  });
});

t.test("it sets user with name", async (t) => {
  const context = createContext();

  runWithContext(context, () => {
    setUser({ id: "id", name: "name" });
    t.same(getContext()?.user, {
      id: "id",
      name: "name",
    });
  });
});

t.test("it logs when setUser has invalid input", async () => {
  const logger = new LoggerForTesting();
  createTestAgent({ logger });

  const context = createContext();

  runWithContext(context, () => {
    // @ts-expect-error User should be an object
    setUser(1);
    t.same(logger.getMessages(), [
      "setUser(...) expects an object with 'id' and 'name' properties, found number instead.",
    ]);
    logger.clear();

    // @ts-expect-error ID should be string or number
    setUser({ id: {} });
    t.same(logger.getMessages(), [
      "setUser(...) expects an object with 'id' property of type string or number, found object instead.",
    ]);
    logger.clear();

    setUser({ id: "" });
    t.same(logger.getMessages(), [
      "setUser(...) expects an object with 'id' property non-empty string.",
    ]);
    logger.clear();

    // @ts-expect-error ID is missing
    setUser({ name: "name" });
    t.same(logger.getMessages(), [
      "setUser(...) expects an object with 'id' property.",
    ]);
    logger.clear();
  });
});

t.test(
  "it does not log warning when setUser is called before middleware",
  async () => {
    const logs: string[] = [];
    wrap(console, "warn", function warn() {
      return function warn(message: string) {
        logs.push(message);
      };
    });

    const context = createContext();
    runWithContext(context, () => {
      setUser({ id: "id" });
    });

    t.same(logs, []);
  }
);

t.test(
  "it logs warning when setUser is called after middleware (once)",
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
      setUser({ id: "id" });
      setUser({ id: "id" });
    });

    t.same(logs, [
      "setUser(...) must be called before the Zen middleware is executed.",
    ]);
  }
);
