import * as t from "tap";
import { getContext, runWithContext, type Context } from "../agent/Context";
import { Postgres } from "./Postgres";
import { createTestAgent } from "../helpers/createTestAgent";

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
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it inspects query method calls and blocks if needed", async (t) => {
  const agent = createTestAgent();
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
      (await client.query({ text: "SELECT petname FROM cats;" })).rows,
      []
    );
    t.same(
      (
        await runWithContext(context, () => {
          return client.query("SELECT petname FROM cats;");
        })
      ).rows,
      []
    );
    t.same(
      (
        await runWithContext(context, () => {
          return client.query({ text: "SELECT petname FROM cats;" });
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
        "Zen has blocked an SQL injection: pg.query(...) originating from body.myTitle"
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
        "Zen has blocked an SQL injection: pg.query(...) originating from body.myTitle"
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
        route: "/posts/:id",
        routeParams: {},
      },
      () => {
        return client.query("-- This is a comment");
      }
    );

    // Check if context is available in the callback
    runWithContext(context, () => {
      client.query("SELECT petname FROM cats;", (error, result) => {
        t.match(getContext(), context);

        try {
          client.query("-- should be blocked", () => {});
        } catch (error: any) {
          t.match(
            error.message,
            /Zen has blocked an SQL injection: pg.query\(\.\.\.\) originating from body\.myTitle/
          );
        }
      });
    });
  } catch (error: any) {
    t.fail(error);
  } finally {
    await client.end();
  }
});
