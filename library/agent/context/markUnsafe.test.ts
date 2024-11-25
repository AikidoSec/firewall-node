import * as t from "tap";
import { createTestAgent } from "../../helpers/createTestAgent";
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
});
