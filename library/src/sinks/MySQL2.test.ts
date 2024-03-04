import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { runWithContext, type Context } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { MySQL2 } from "./MySQL2";

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
};

const safeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000/",
  query: {},
  headers: {},
  body: {},
  cookies: {},
};

t.test("it detects SQL injections", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    true
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

    const bulkError = await t.rejects(async () => {
      await runWithContext(dangerousContext, () => {
        return connection.query("-- should be blocked");
      });
    });

    if (bulkError instanceof Error) {
      t.equal(
        bulkError.message,
        "Aikido guard has blocked a SQL injection: -- should be blocked originating from body"
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
  } catch (error: any) {
    t.fail(error);
  } finally {
    await connection.end();
  }
});
