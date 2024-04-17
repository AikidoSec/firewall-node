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
  source: "express",
};

t.test("it inspects query method calls and blocks if needed", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    "lambda"
  );
  agent.start([new Postgres()]);

  const { Client } = require("pg");
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
      );
    `);
    await client.query("TRUNCATE cats");

    t.same((await client.query("SELECT petname FROM cats;")).rows, []);
    t.same(
      (
        await runWithContext(context, () => {
          return client.query("SELECT petname FROM cats;");
        })
      ).rows,
      []
    );

    const error = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query("-- should be blocked");
      });
    });
    if (error instanceof Error) {
      t.same(
        error.message,
        "Aikido runtime has blocked a SQL injection: pg.query(...) originating from body.myTitle"
      );
    }

    const error2 = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query({ text: "-- should be blocked" });
      });
    });
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Aikido runtime has blocked a SQL injection: pg.query(...) originating from body.myTitle"
      );
    }

    const undefinedQueryError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query(null);
      });
    });
    if (undefinedQueryError instanceof Error) {
      t.same(
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
        source: "express",
      },
      () => {
        return client.query("-- This is a comment");
      }
    );
  } catch (error: any) {
    t.fail(error);
  } finally {
    await client.end();
  }
});
