import * as t from "tap";
import { createTestAgent } from "../../helpers/createTestAgent";
import { wrap } from "../../helpers/wrap";
import { checkContextForSqlInjection } from "../../vulnerabilities/sql-injection/checkContextForSqlInjection";
import { SQLDialectPostgres } from "../../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { Context, getContext, runWithContext } from "../Context";
import { markUnsafe } from "./markUnsafe";

function createContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: {
      image: "http://localhost:4000/api/internal",
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

t.test("it works", async () => {
  const agent = createTestAgent({});
  agent.start([]);

  // No unsafe input
  runWithContext(createContext(), () => {
    const context = getContext();

    if (!context) {
      throw new Error("Context is not defined");
    }

    const result = checkContextForSqlInjection({
      sql: 'SELECT * FROM "users" WHERE id = 1',
      operation: "pg.query",
      dialect: new SQLDialectPostgres(),
      context: context,
    });
    t.same(result, undefined);
  });

  // Unsafe string
  runWithContext(createContext(), () => {
    markUnsafe("id = 1");

    const context = getContext();

    if (!context) {
      throw new Error("Context is not defined");
    }

    const result = checkContextForSqlInjection({
      sql: 'SELECT * FROM "users" WHERE id = 1',
      operation: "pg.query",
      dialect: new SQLDialectPostgres(),
      context: context,
    });
    t.same(result, {
      kind: "sql_injection",
      operation: "pg.query",
      source: "markUnsafe",
      metadata: {
        sql: 'SELECT * FROM "users" WHERE id = 1',
        dialect: "PostgreSQL",
      },
      payload: "id = 1",
      pathsToPayload: [".[0]"],
    });
  });

  // Unsafe object
  runWithContext(createContext(), () => {
    markUnsafe({ somePropertyThatContainsSQL: "id = 1" });

    const context = getContext();

    if (!context) {
      throw new Error("Context is not defined");
    }

    const result = checkContextForSqlInjection({
      sql: 'SELECT * FROM "users" WHERE id = 1',
      operation: "pg.query",
      dialect: new SQLDialectPostgres(),
      context: context,
    });
    t.same(result, {
      kind: "sql_injection",
      operation: "pg.query",
      source: "markUnsafe",
      metadata: {
        sql: 'SELECT * FROM "users" WHERE id = 1',
        dialect: "PostgreSQL",
      },
      payload: "id = 1",
      pathsToPayload: [".[0].somePropertyThatContainsSQL"],
    });
  });

  // Test markUnsafe called without context
  const logs: string[] = [];
  wrap(console, "warn", function warn() {
    return function warn(message: string) {
      logs.push(message);
    };
  });
  markUnsafe("id = 1");
  t.same(logs, [
    "markUnsafe(...) was called without a context. The data will not be tracked. Make sure to call markUnsafe(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports).",
  ]);

  // Warning logged only once
  markUnsafe("id = 1");
  t.same(logs.length, 1);

  // Test if serialize fails
  runWithContext(createContext(), () => {
    // Define an object with a circular reference
    const obj: Record<string, any> = {};
    obj.self = obj;
    markUnsafe(obj);
  });
  t.same(logs, [
    "markUnsafe(...) was called without a context. The data will not be tracked. Make sure to call markUnsafe(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports).",
    "markUnsafe(...) failed to serialize the data",
  ]);

  runWithContext(createContext(), () => {
    markUnsafe();
  });
  t.same(logs, [
    "markUnsafe(...) was called without a context. The data will not be tracked. Make sure to call markUnsafe(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports).",
    "markUnsafe(...) failed to serialize the data",
    "markUnsafe(...) was called without any data.",
  ]);

  runWithContext(createContext(), () => {
    markUnsafe(1, true, null, undefined, () => {}, Symbol("test"));
  });
  t.same(logs, [
    "markUnsafe(...) was called without a context. The data will not be tracked. Make sure to call markUnsafe(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports).",
    "markUnsafe(...) failed to serialize the data",
    "markUnsafe(...) was called without any data.",
    "markUnsafe(...) expects an object, array, or string. Received: number",
    "markUnsafe(...) expects an object, array, or string. Received: boolean",
    "markUnsafe(...) expects an object, array, or string. Received: null",
    "markUnsafe(...) expects an object, array, or string. Received: undefined",
    "markUnsafe(...) expects an object, array, or string. Received: function",
    "markUnsafe(...) expects an object, array, or string. Received: symbol",
  ]);
});
