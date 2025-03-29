import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { LibSQL } from "./LibSQL";
import { createTestAgent } from "../helpers/createTestAgent";

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

const agent = createTestAgent();
agent.start([new LibSQL()]);

t.test("it detects SQL injections", async (t) => {
  const Database = require("libsql") as typeof import("libsql");
  const db = new Database(":memory:");

  try {
    db.exec("CREATE TABLE IF NOT EXISTS cats (petname varchar(255));");
    db.exec("DELETE FROM cats;");
    const rows = db.prepare("SELECT petname FROM `cats`;").all();
    t.same(rows, []);

    runWithContext(dangerousContext, () => {
      const error = t.throws(() => db.exec("SELECT 1;-- should be blocked"));
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: libsql.exec(...) originating from body.myTitle"
        );
      }

      const error2 = t.throws(() =>
        db.prepare("SELECT 1;-- should be blocked")
      );
      t.ok(error2 instanceof Error);
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Zen has blocked an SQL injection: libsql.prepare(...) originating from body.myTitle"
        );
      }

      db.transaction(() => {
        const error = t.throws(() => db.exec("SELECT 1;-- should be blocked"));
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked an SQL injection: libsql.exec(...) originating from body.myTitle"
          );
        }
      });
    });

    await runWithContext(safeContext, async () => {
      db.exec("SELECT 1;-- This is a comment");

      // Invalid parameters are still passed to lib
      // @ts-expect-error we are testing invalid parameters
      const error = t.throws(() => db.exec([]));
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(error.message, "failed to downcast any to string");
      }
    });
  } catch (error: any) {
    t.fail(error);
  } finally {
    await db.close();
  }
});

t.test("it detects SQL injections using promises", async (t) => {
  const Database = require("libsql/promise");
  const db = new Database(":memory:");

  try {
    await db.exec("CREATE TABLE IF NOT EXISTS cats (petname varchar(255));");
    await db.exec("DELETE FROM cats;");
    const rows = await (await db.prepare("SELECT petname FROM `cats`;")).all();
    t.same(rows, []);

    runWithContext(dangerousContext, async () => {
      const error = t.throws(() => db.exec("SELECT 1;-- should be blocked"));
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: libsql.exec(...) originating from body.myTitle"
        );
      }

      const error2 = t.throws(() =>
        db.prepare("SELECT 1;-- should be blocked")
      );
      t.ok(error2 instanceof Error);
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Zen has blocked an SQL injection: libsql.prepare(...) originating from body.myTitle"
        );
      }

      await db.transaction(async () => {
        const error = t.throws(() => db.exec("SELECT 1;-- should be blocked"));
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked an SQL injection: libsql.exec(...) originating from body.myTitle"
          );
        }
      });
    });

    await runWithContext(safeContext, async () => {
      db.exec("SELECT 1;-- This is a comment");

      // Invalid parameters are still passed to lib
      const error = t.throws(() => db.exec([]));
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(error.message, "failed to downcast any to string");
      }
    });
  } catch (error: any) {
    t.fail(error);
  } finally {
    await db.close();
  }
});
