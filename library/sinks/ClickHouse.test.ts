import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { ClickHouse } from "./ClickHouse";
import { createTestAgent } from "../helpers/createTestAgent";
import { isWindowsCi } from "../helpers/isWindowsCi";

const dangerousContext: Context = {
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

const safeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000/",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test(
  "it detects SQL injections",
  {
    skip: isWindowsCi ? "Skip on Windows CI" : false,
  },
  async (t) => {
    const agent = createTestAgent();
    agent.start([new ClickHouse()]);

    const { createClient } =
      require("@clickhouse/client") as typeof import("@clickhouse/client");

    const client = createClient({
      url: "http://localhost:27019",
      username: "clickhouse",
      password: "clickhouse",
      database: "main_db",
    });

    try {
      await client.exec({
        query: `CREATE TABLE IF NOT EXISTS cats (
          id UInt64 PRIMARY KEY,
          petname String
      );
    `,
      });

      await client.command({
        query: `TRUNCATE TABLE cats;`,
      });

      await client.insert({
        table: "cats",
        values: [[1, "Felix"]],
      });

      // Query for cats
      const resultSet = await client.query({
        query: `SELECT * FROM cats;`,
        format: "JSONEachRow",
      });

      t.same(await resultSet.json(), [{ id: 1, petname: "Felix" }]);

      await runWithContext(safeContext, async () => {
        const resultSet = await client.query({
          query: `SELECT * FROM cats;`,
          format: "JSONEachRow",
        });
        t.same(await resultSet.json(), [{ id: 1, petname: "Felix" }]);
      });

      await runWithContext(dangerousContext, async () => {
        try {
          await client.query({
            query: `SELECT * FROM cats -- should be blocked;`,
            format: "JSONEachRow",
          });
          t.fail("Expected an error");
        } catch (error) {
          t.ok(error instanceof Error);
          if (error instanceof Error) {
            t.same(
              error.message,
              "Zen has blocked an SQL injection: query(...) originating from body.myTitle"
            );
          }
        }

        try {
          await client.command({
            query: `TRUNCATE TABLE cats; DELETE FROM cats; -- should be blocked;`,
          });
          t.fail("Expected an error");
        } catch (error) {
          t.ok(error instanceof Error);
          if (error instanceof Error) {
            t.same(
              error.message,
              "Zen has blocked an SQL injection: command(...) originating from body.myTitle"
            );
          }
        }

        try {
          await client.command({
            // @ts-expect-error Testing invalid query - error should be thrown by ClickHouse
            query: [],
          });
          t.fail("Expected an error");
        } catch (error) {
          t.ok(error instanceof Error);
          if (error instanceof Error) {
            t.match(error.message, "params.query.trim is not a function");
          }
        }
      });

      client.close();
    } catch (error) {
      t.error(error);
    }
  }
);
