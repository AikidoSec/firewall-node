import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Postgresjs } from "./Postgresjs";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
import { startTestAgent } from "../helpers/startTestAgent";

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

export async function createPostgresjsTests(packageName: string) {
  t.test("it inspects query method calls and blocks if needed", async (t) => {
    startTestAgent({
      wrappers: [new Postgresjs()],
      rewrite: {
        postgres: packageName,
      },
    });

    let postgres = require(packageName) as typeof import("postgres-v3");

    if (isEsmUnitTest() || typeof postgres !== "function") {
      // @ts-expect-error ESM not covered by types
      postgres = postgres.default;
    }

    const sql = postgres("postgres://root:password@127.0.0.1:27016/main_db");

    try {
      await sql`
      CREATE TABLE IF NOT EXISTS cats_2 (
        petname varchar(255)
      );
    `;
      await sql`TRUNCATE cats_2`;

      const cats = [
        {
          petname: "Fluffy",
        },
        {
          petname: "Garfield",
        },
      ];

      await sql`insert into cats_2 ${sql(cats, "petname")}`;

      const transactionResult = await sql.begin((sql) => [
        sql`SELECT * FROM cats_2`,
      ]);
      t.same(transactionResult[0], cats);

      t.same(await sql`select * from ${sql("cats_2")}`, cats);
      t.same(await sql.unsafe("SELECT * FROM cats_2"), cats);

      await runWithContext(context, async () => {
        t.same(await sql`select * from ${sql("cats_2")}`, cats);
        t.same(await sql.unsafe("SELECT * FROM cats_2"), cats);

        const error = await t.rejects(async () => {
          await sql.unsafe(
            `SELECT * FROM cats_2 WHERE petname = test; -- should be blocked`
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
                await sql.unsafe(
                  `SELECT id FROM cats_2 WHERE petname = '${injection}'`
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
              `Zen has blocked an SQL injection: sql.unsafe(...) originating from body.myTitle${index}`
            );
          }
        }
      }
    } catch (error: any) {
      t.fail(error);
    } finally {
      await sql.end();
    }
  });

  t.test(
    "it inspects unsafe on clients from begin(), savepoint() and reserve()",
    async (t) => {
      startTestAgent({
        wrappers: [new Postgresjs()],
        rewrite: {
          postgres: packageName,
        },
      });

      let postgres = require(packageName) as typeof import("postgres-v3");

      if (isEsmUnitTest() || typeof postgres !== "function") {
        // @ts-expect-error ESM not covered by types
        postgres = postgres.default;
      }

      const sql = postgres("postgres://root:password@127.0.0.1:27016/main_db");
      const injection = `SELECT 1 WHERE 'a' = 'x'; -- should be blocked`;
      const expectedMessage =
        "Zen has blocked an SQL injection: sql.unsafe(...) originating from body.myTitle";

      try {
        await runWithContext(context, async () => {
          const rootError = await t.rejects(async () => {
            await sql.unsafe(injection);
          });
          t.same((rootError as Error).message, expectedMessage);

          const beginError = await t.rejects(async () => {
            await sql.begin(async (tx) => {
              await tx.unsafe(injection);
            });
          });
          t.same((beginError as Error).message, expectedMessage);

          const savepointError = await t.rejects(async () => {
            await sql.begin(async (tx) => {
              await tx.savepoint(async (sp) => {
                await sp.unsafe(injection);
              });
            });
          });
          t.same((savepointError as Error).message, expectedMessage);

          const reserved = await sql.reserve();
          try {
            const reserveError = await t.rejects(async () => {
              await reserved.unsafe(injection);
            });
            t.same((reserveError as Error).message, expectedMessage);
          } finally {
            reserved.release();
          }
        });
      } finally {
        await sql.end();
      }
    }
  );
}
