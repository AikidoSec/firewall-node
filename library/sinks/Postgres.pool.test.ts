import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
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

t.test("it detects SQL injections", async () => {
  const agent = createTestAgent({
    serverless: "lambda",
  });

  agent.start([new Postgres()]);

  const { Pool } = require("pg") as typeof import("pg");
  const pool = new Pool({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
    max: 5,
  });

  await pool.query(`
      CREATE TABLE IF NOT EXISTS users_pgpool (
        id SERIAL PRIMARY KEY,
        name varchar(255)
      );
    `);

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
      );
    `);
    await client.query("TRUNCATE cats");
    t.same((await client.query("SELECT petname FROM cats;")).rows, []);

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

    const undefinedQueryError = await t.rejects(async () => {
      await runWithContext(context, () => {
        // @ts-expect-error Testing with invalid query
        return client.query(null);
      });
    });
    if (undefinedQueryError instanceof Error) {
      t.same(
        undefinedQueryError.message,
        "Client was passed a null or undefined query"
      );
    }

    const error2 = await t.rejects(async () => {
      await runWithContext(context, () => {
        return pool.query({ text: "-- should be blocked" });
      });
    });
    t.ok(error2 instanceof Error);
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Zen has blocked an SQL injection: pg.query(...) originating from body.myTitle"
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

    t.same((await pool.query("SELECT petname FROM cats;")).rows, []);
    t.same(
      (
        await pool.query({
          text: "SELECT petname FROM cats;",
        })
      ).rows,
      []
    );

    const numberOfQueries = 50;

    const results = await Promise.allSettled(
      Array.from({ length: numberOfQueries }, (_, index) => {
        const contextKey = `myTitle${index}`;
        const injection = `abc' OR 1=1; -- should be blocked ${index}`;

        return runWithContext(
          {
            remoteAddress: "::1",
            method: "POST",
            url: "http://localhost:4000",
            query: {},
            headers: {},
            body: {
              [contextKey]: injection,
            },
            cookies: {},
            routeParams: {},
            source: "hono",
            route: "/posts/:id",
          },
          async () => {
            try {
              await pool.query(
                `SELECT id FROM users_pgpool WHERE name = '${injection}'`
              );
              return {
                index,
                error: null,
              };
            } catch (error: any) {
              return {
                index,
                error,
              };
            }
          }
        );
      })
    );

    t.equal(results.length, numberOfQueries);

    for (const result of results) {
      t.equal(result.status, "fulfilled");

      if (result.status === "fulfilled") {
        const { index, error } = result.value;
        t.ok(error instanceof Error);

        if (error instanceof Error) {
          t.same(
            error.message,
            `Zen has blocked an SQL injection: pg.query(...) originating from body.myTitle${index}`
          );
        }
      }
    }
  } catch (error: any) {
    t.fail(error);
  } finally {
    client.release();
    await pool.end();
  }
});
