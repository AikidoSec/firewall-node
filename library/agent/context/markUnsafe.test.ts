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
      },
      payload: "id = 1",
      pathToPayload: ".",
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
      },
      payload: "id = 1",
      pathToPayload: ".[0].somePropertyThatContainsSQL",
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
    "markUnsafe(...) was called without a context. The payload will not be tracked. Make sure to call markUnsafe(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen.",
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
    "markUnsafe(...) was called without a context. The payload will not be tracked. Make sure to call markUnsafe(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen.",
    "markUnsafe(...) failed to serialize the payload",
  ]);
});
