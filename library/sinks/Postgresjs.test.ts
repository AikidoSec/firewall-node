import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Postgresjs } from "./Postgresjs";
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
  agent.start([new Postgresjs()]);

  const postgres = require("postgres") as typeof import("postgres");
  const sql = postgres("postgres://root:password@127.0.0.1:27016/main_db");

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
      );
    `;
    await sql`TRUNCATE cats`;

    const cats = [
      {
        petname: "Fluffy",
      },
      {
        petname: "Garfield",
      },
    ];

    await sql`insert into cats ${sql(cats, "petname")}`;

    const transactionResult = await sql.begin((sql) => [
      sql`SELECT * FROM cats`,
    ]);
    t.same(transactionResult[0], cats);

    t.same(await sql`select * from ${sql("cats")}`, cats);
    t.same(await sql.unsafe("SELECT * FROM cats"), cats);

    await runWithContext(context, async () => {
      t.same(await sql`select * from ${sql("cats")}`, cats);
      t.same(await sql.unsafe("SELECT * FROM cats"), cats);

      const error = await t.rejects(async () => {
        await sql.unsafe(
          `SELECT * FROM cats WHERE petname = test; -- should be blocked`
        );
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: sql.unsafe(...) originating from body.myTitle"
        );
      }

      await sql.unsafe("");
    });
  } catch (error: any) {
    t.fail(error);
  } finally {
    await sql.end();
  }
});
