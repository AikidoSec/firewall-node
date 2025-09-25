import * as t from "tap";
import { checkContextForSqlInjection } from "./checkContextForSqlInjection";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { addHook } from "../../agent/hooks";

t.test("it returns correct path", async () => {
  t.same(
    checkContextForSqlInjection({
      sql: "SELECT * FROM users WHERE id = '1' OR 1=1; -- '",
      operation: "mysql.query",
      dialect: new SQLDialectMySQL(),
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {},
        body: {
          id: "1' OR 1=1; --",
        },
        source: "express",
        route: "/",
        routeParams: {},
      },
    }),
    {
      operation: "mysql.query",
      kind: "sql_injection",
      source: "body",
      pathsToPayload: [".id"],
      metadata: {
        sql: "SELECT * FROM users WHERE id = '1' OR 1=1; -- '",
        dialect: "MySQL",
      },
      payload: "1' OR 1=1; --",
    }
  );
});

t.test("it executes hooks", async () => {
  let hookCalled = 0;

  function hook(sql: string) {
    t.equal(
      sql,
      "SELECT * FROM users WHERE id = '1' OR 1=1; -- '",
      "hook called with correct sql"
    );
    hookCalled++;
  }

  addHook("beforeSQLExecute", hook);

  t.same(
    checkContextForSqlInjection({
      sql: "SELECT * FROM users WHERE id = '1' OR 1=1; -- '",
      operation: "mysql.query",
      dialect: new SQLDialectMySQL(),
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {},
        body: {
          id: "1' OR 1=1; --",
        },
        source: "express",
        route: "/",
        routeParams: {},
      },
    }),
    {
      operation: "mysql.query",
      kind: "sql_injection",
      source: "body",
      pathsToPayload: [".id"],
      metadata: {
        sql: "SELECT * FROM users WHERE id = '1' OR 1=1; -- '",
        dialect: "MySQL",
      },
      payload: "1' OR 1=1; --",
    }
  );

  t.equal(hookCalled, 1, "hook called once");
});
