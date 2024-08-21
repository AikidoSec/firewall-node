import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { runWithContext, type Context } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { BetterSQLite3 } from "./BetterSQLite3";

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

t.test("it detects SQL injections", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    "lambda"
  );
  agent.start([new BetterSQLite3()]);

  const betterSqlite3 = require("better-sqlite3");
  const db = new betterSqlite3(":memory:");

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
          "Aikido firewall has blocked an SQL injection: better-sqlite3.exec(...) originating from body.myTitle"
        );
      }

      const error2 = t.throws(() =>
        db.prepare("SELECT 1;-- should be blocked")
      );
      t.ok(error2 instanceof Error);
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Aikido firewall has blocked an SQL injection: better-sqlite3.prepare(...) originating from body.myTitle"
        );
      }

      db.transaction(() => {
        const error = t.throws(() => db.exec("SELECT 1;-- should be blocked"));
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Aikido firewall has blocked an SQL injection: better-sqlite3.exec(...) originating from body.myTitle"
          );
        }
      });
    });

    runWithContext(safeContext, () => {
      db.exec("SELECT 1;-- This is a comment");

      const error = t.throws(() => db.exec([]));
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(error.message, "Expected first argument to be a string");
      }
    });

    runWithContext(dangerousPathContext, () => {
      const error = t.throws(() => db.backup("/tmp/insecure"));
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(
          error.message,
          "Aikido firewall has blocked a path traversal attack: better-sqlite3.backup(...) originating from body.myTitle"
        );
      }
    });
  } catch (error: any) {
    t.fail(error);
  } finally {
    await db.close();
  }
});
