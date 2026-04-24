import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { SQLite3 } from "./SQLite3";
import { promisify } from "util";
import { createTestAgent } from "../helpers/createTestAgent";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";

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

const dangerousPathContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `/tmp/insecure`,
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
    skip: isEsmUnitTest() && getMajorNodeVersion() >= 25,
  },
  async () => {
    const agent = createTestAgent({
      serverless: "lambda",
    });
    agent.start([new SQLite3()]);

    let sqlite3 = require("sqlite3") as typeof import("sqlite3");

    if (isEsmUnitTest()) {
      // @ts-expect-error ESM not covered by types
      sqlite3 = sqlite3.default;
    }

    const db = new sqlite3.Database(":memory:");
    const run = promisify(db.run.bind(db));
    const all = promisify(db.all.bind(db));
    // @ts-expect-error Wrong library types
    const backup = promisify(db.backup.bind(db));
    const exec = promisify(db.exec.bind(db));
    const close = promisify(db.close.bind(db));

    try {
      await run("CREATE TABLE IF NOT EXISTS cats (petname varchar(255));");
      await run("DELETE FROM cats;");
      const rows = await all("SELECT petname FROM `cats`;");
      t.same(rows, []);

      const error = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return run("SELECT 1;-- should be blocked");
        });
      });
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: sqlite3.run(...) originating from body.myTitle"
        );
      }

      const error2 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return run("");
        });
      });
      if (error2 instanceof Error) {
        t.same(error2.message, "SQLITE_MISUSE: not an error");
      }

      await runWithContext(safeContext, () => {
        return run("SELECT 1;-- This is a comment");
      });

      await runWithContext(safeContext, () => {
        return all("SELECT 1");
      });

      const error3 = await t.rejects(async () => {
        await runWithContext(dangerousPathContext, () => {
          return backup("/tmp/insecure");
        });
      });
      if (error3 instanceof Error) {
        t.same(
          error3.message,
          "Zen has blocked a path traversal attack: sqlite3.backup(...) originating from body.myTitle"
        );
      }

      const error4 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return exec("SELECT 1;-- should be blocked");
        });
      });
      if (error4 instanceof Error) {
        t.same(
          error4.message,
          "Zen has blocked an SQL injection: sqlite3.exec(...) originating from body.myTitle"
        );
      }

      // Query with syntax error and user input should be blocked by Zen
      // because the SQL tokenizer can't parse the query (unclosed quote)
      process.env.AIKIDO_BLOCK_INVALID_SQL = "true";
      const syntaxError = await t.rejects(async () => {
        await runWithContext(
          { ...dangerousContext, body: { name: "SELECT * FROM test" } },
          () => {
            return run(`SELECT ' SELECT * FROM test`);
          }
        );
      });
      if (syntaxError instanceof Error) {
        t.same(
          syntaxError.message,
          "Zen has blocked an SQL injection: sqlite3.run(...) originating from body.name"
        );
      }
      delete process.env.AIKIDO_BLOCK_INVALID_SQL;

      await new Promise<void>((resolve) => {
        runWithContext(dangerousContext, () => {
          db.run("SELECT 1;-- should be blocked", (err: Error | null) => {
            t.ok(err instanceof Error);
            t.same(
              err?.message,
              "Zen has blocked an SQL injection: sqlite3.run(...) originating from body.myTitle"
            );
            resolve();
          });
        });
      });
    } catch (error: any) {
      t.fail(error);
    } finally {
      await close();
    }
  }
);
