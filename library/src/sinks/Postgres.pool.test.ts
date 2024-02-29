import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { runWithContext, type Context } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Postgres } from "./Postgres";

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
};

t.test("it detects SQL injections", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    true
  );
  agent.start([new Postgres()]);

  const { Pool } = require("pg");
  const pool = new Pool({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
  });

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
      );
    `);
    await client.query("TRUNCATE cats");
    t.same((await client.query("SELECT petname FROM cats;")).rows, []);

    const bulkError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query("-- should be blocked");
      });
    });
    if (bulkError instanceof Error) {
      t.equal(
        bulkError.message,
        "Aikido guard has blocked a SQL injection: -- should be blocked originating from body"
      );
    }

    const undefinedQueryError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query(null);
      });
    });
    if (undefinedQueryError instanceof Error) {
      t.equal(
        undefinedQueryError.message,
        "Client was passed a null or undefined query"
      );
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
      },
      () => {
        return client.query("-- This is a comment");
      }
    );
  } catch (error: any) {
    t.fail(error);
  } finally {
    client.release();
    await pool.end();
  }
});
