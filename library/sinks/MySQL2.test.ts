import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { runWithContext, type Context } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { MySQL2 } from "./MySQL2";
import { isWindows } from "../helpers/isWindows";

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
    skip:
      isWindows && process.env.CI
        ? "CI on Windows does not support containers"
        : false,
  },
  async () => {
    const agent = new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      undefined,
      "lambda"
    );
    agent.start([new MySQL2()]);

    const mysql = require("mysql2/promise");

    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27015,
      multipleStatements: true,
    });

    try {
      await connection.query(
        `
        CREATE TABLE IF NOT EXISTS cats (
            petname varchar(255)
        );
      `
      );
      await connection.execute("TRUNCATE cats");
      const [rows] = await connection.query("SELECT petname FROM `cats`;");
      t.same(rows, []);
      const [moreRows] = await connection.query({
        sql: "SELECT petname FROM `cats`",
      });
      t.same(moreRows, []);

      const error = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.query("-- should be blocked");
        });
      });
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: mysql2.query(...) originating from body.myTitle"
        );
      }

      const error2 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.query({ sql: "-- should be blocked" });
        });
      });
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Zen has blocked an SQL injection: mysql2.query(...) originating from body.myTitle"
        );
      }

      const undefinedQueryError = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.query(undefined);
        });
      });

      if (undefinedQueryError instanceof Error) {
        t.same(
          undefinedQueryError.message,
          "Cannot read properties of undefined (reading 'constructor')"
        );
      }

      await runWithContext(safeContext, () => {
        return connection.query("-- This is a comment");
      });

      await runWithContext(safeContext, () => {
        return connection.execute("SELECT 1");
      });
    } catch (error: any) {
      t.fail(error);
    } finally {
      await connection.end();
    }
  }
);
