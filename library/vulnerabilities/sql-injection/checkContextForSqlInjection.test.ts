import t from "tap";
import { checkContextForSqlInjection } from "./checkContextForSqlInjection";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";

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
      pathToPayload: ".id",
      metadata: {
        sql: "SELECT * FROM users WHERE id = '1' OR 1=1; -- '",
      },
      payload: "1' OR 1=1; --",
    }
  );
});
