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

t.test("does not break when the Node.js version is too low", async (t) => {
  const agent = createTestAgent();
  agent.start([new NodeSQLite()]);

  t.end();
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

    const { DatabaseSync } = require("node:sqlite");

    const db = new DatabaseSync(":memory:");

    try {
      db.exec("CREATE TABLE IF NOT EXISTS cats (petname varchar(255));");
      // Does not detect SQL injection, function does not return anything
      db.exec("SELECT petname FROM `cats`;");

      runWithContext(dangerousContext, () => {
        try {
          db.exec("SELECT 1;-- should be blocked");
          t.fail("Expected an error");
        } catch (error: any) {
          t.match(
            error.message,
            /Zen has blocked an SQL injection: node:sqlite.exec/
          );
        }
      });

      runWithContext(safeContext, () => {
        db.exec("SELECT 1;-- This is a comment");
      });

      runWithContext(dangerousContext, () => {
        try {
          db.prepare("SELECT 1;-- should be blocked");
          t.fail("Expected an error");
        } catch (error: any) {
          t.match(
            error.message,
            /Zen has blocked an SQL injection: node:sqlite.prepare/
          );
        }
      });

      runWithContext(safeContext, () => {
        db.prepare("SELECT 1;-- This is a comment");

        try {
          db.exec();
        } catch (error: any) {
          t.match(error.message, /The "sql" argument must be a string./);
        }
      });
    } catch (error: any) {
      t.fail(error);
    } finally {
      db.close();
    }
  }
);
