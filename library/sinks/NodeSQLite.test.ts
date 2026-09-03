import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { NodeSQLite } from "./NodeSQLite";
import { isPackageInstalled } from "../helpers/isPackageInstalled";
import { createTestAgent } from "../helpers/createTestAgent";

const dangerousContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `kitty' OR 1=1; --`,
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

t.test("does not break when the Node.js version is too low", async (t) => {
  const agent = createTestAgent();
  agent.start([new NodeSQLite()]);

  t.end();
});

t.test("covers internal helper fallbacks", async (t) => {
  const sqlite = new NodeSQLite() as any;
  const statement = {};

  t.equal(sqlite.addRawQueryToStatement(statement, []), statement);
  t.equal(sqlite.addRawQueryToStatement(statement, [123]), statement);

  const unresolved = sqlite.resolvePlaceholder(
    "tenant_id",
    undefined,
    { tenant_id: "org_123" },
    []
  );

  t.equal(unresolved, undefined);
});

t.test(
  "it detects SQL injections",
  {
    skip: !isPackageInstalled("node:sqlite")
      ? "node:sqlite not available"
      : false,
  },
  async () => {
    const agent = createTestAgent();
    agent.start([new NodeSQLite()]);

    const { DatabaseSync } =
      require("node:sqlite") as typeof import("node:sqlite");

    const db = new DatabaseSync(":memory:");

    try {
      db.exec("CREATE TABLE IF NOT EXISTS cats (petname varchar(255));");
      // Does not detect SQL injection, function does not return anything
      db.exec("SELECT petname FROM `cats`;");

      db.prepare("DELETE FROM cats;").run();

      runWithContext(dangerousContext, () => {
        try {
          db.exec(
            "SELECT petname FROM cats WHERE petname = 'kitty' OR 1=1; --';"
          );
          t.fail("Expected an error");
        } catch (error: any) {
          t.match(
            error.message,
            /Zen has blocked an SQL injection: node:sqlite.exec/
          );
        }
      });

      runWithContext(safeContext, () => {
        db.exec(
          "SELECT petname FROM cats WHERE petname = 'kitty' OR 1=1; --';"
        );
      });

      runWithContext(dangerousContext, () => {
        try {
          db.prepare(
            "SELECT petname FROM cats WHERE petname = 'kitty' OR 1=1; --';"
          ).get();
          t.fail("Expected an error");
        } catch (error: any) {
          t.match(
            error.message,
            /Zen has blocked an SQL injection: node:sqlite.StatementSync.get\(\.\.\.\)/
          );
        }

        try {
          db.prepare(
            "SELECT petname FROM cats WHERE petname = 'kitty' OR 1=1; --';"
          ).all();
          t.fail("Expected an error");
        } catch (error: any) {
          t.match(
            error.message,
            /Zen has blocked an SQL injection: node:sqlite.StatementSync.all\(\.\.\.\)/
          );
        }

        try {
          db.prepare(
            "SELECT petname FROM cats WHERE petname = 'kitty' OR 1=1; --';"
          ).run();
          t.fail("Expected an error");
        } catch (error: any) {
          t.match(
            error.message,
            /Zen has blocked an SQL injection: node:sqlite.StatementSync.run\(\.\.\.\)/
          );
        }
      });

      runWithContext(safeContext, () => {
        db.prepare(
          "SELECT petname FROM cats WHERE petname = 'kitty' OR 1=1; --';"
        ).get();

        try {
          // @ts-expect-error - testing behavior when no SQL query is provided
          db.exec();
        } catch (error: any) {
          t.match(error.message, /The "sql" argument must be a string./);
        }
      });

      // Not supported in some Node.js versions
      if (typeof db.createTagStore === "function") {
        const tagStore = db.createTagStore();

        runWithContext(dangerousContext, () => {
          try {
            const result = tagStore.get`SELECT petname FROM cats WHERE petname = 'kitty' OR 1=1; --';`;
            t.same(result, undefined); // Ignore unused result
            t.fail("Expected an error");
          } catch (error: any) {
            t.match(
              error.message,
              /Zen has blocked an SQL injection: node:sqlite.SQLTagStore.get\(\.\.\.\)/
            );
          }

          try {
            const result = tagStore.all`SELECT petname FROM cats WHERE petname = 'kitty' OR 1=1; --';`;
            t.same(result, undefined); // Ignore unused result
            t.fail("Expected an error");
          } catch (error: any) {
            t.match(
              error.message,
              /Zen has blocked an SQL injection: node:sqlite.SQLTagStore.all\(\.\.\.\)/
            );
          }

          try {
            // @ts-expect-error - testing behavior when no SQL query is provided
            db.prepare(undefined).all();
            t.fail("Expected an error");
          } catch (error: any) {
            t.match(error.message, /argument must be a string/);
          }
        });

        runWithContext(safeContext, () => {
          const result = tagStore.get`SELECT petname FROM cats WHERE petname = 'kitty' OR 1=1; --';`;
          t.same(result, undefined);
        });
      }
    } catch (error: any) {
      t.fail(error);
    } finally {
      db.close();
    }
  }
);
