import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { runWithContext, type Context } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { MySQL } from "./MySQL";
import type { Connection } from "mysql";

function query(sql: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    connection.query(sql, (error, results) => {
      if (error) {
        return reject(error);
      }

      resolve(results);
    });
  });
}

function queryViaOptions(sql: { sql: string }, connection: Connection) {
  return new Promise((resolve, reject) => {
    connection.query(sql, (error, results) => {
      if (error) {
        return reject(error);
      }

      resolve(results);
    });
  });
}

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `-- should be blocked`,
  },
  cookies: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it detects SQL injections", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    "lambda"
  );
  agent.start([new MySQL()]);

  const mysql = require("mysql");
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
    multipleStatements: true,
  });

  try {
    await query(
      `
        CREATE TABLE IF NOT EXISTS cats (
            petname varchar(255)
        );
      `,
      connection
    );
    await query("TRUNCATE cats", connection);
    t.same(await query("SELECT petname FROM `cats`;", connection), []);
    t.same(
      await queryViaOptions({ sql: "SELECT petname FROM `cats`;" }, connection),
      []
    );
    t.same(
      await runWithContext(context, () => {
        return query("SELECT petname FROM `cats`;", connection);
      }),
      []
    );
    t.same(
      await runWithContext(context, () => {
        return queryViaOptions(
          { sql: "SELECT petname FROM `cats`;" },
          connection
        );
      }),
      []
    );

    const error = await t.rejects(async () => {
      await runWithContext(context, () => {
        return connection.query("-- should be blocked");
      });
    });

    if (error instanceof Error) {
      t.same(
        error.message,
        "Aikido runtime has blocked a SQL injection: MySQL.query(...) originating from body.myTitle"
      );
    }

    const error2 = await t.rejects(async () => {
      await runWithContext(context, () => {
        return connection.query({ sql: "-- should be blocked" });
      });
    });

    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Aikido runtime has blocked a SQL injection: MySQL.query(...) originating from body.myTitle"
      );
    }

    const undefinedQueryError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return query(undefined, connection);
      });
    });

    if (undefinedQueryError instanceof Error) {
      t.same(undefinedQueryError.message, "ER_EMPTY_QUERY: Query was empty");
    }

    await runWithContext(
      {
        remoteAddress: "::1",
        method: "POST",
        url: "http://localhost:4000/",
        query: {},
        headers: {},
        body: {},
        cookies: {},
        source: "express",
      },
      () => {
        return connection.query("-- This is a comment");
      }
    );
  } catch (error: any) {
    t.fail(error);
  } finally {
    await connection.end();
  }
});
