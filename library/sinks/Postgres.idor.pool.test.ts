import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Postgres } from "./Postgres";
import { createTestAgent } from "../helpers/createTestAgent";
import { withoutIdorProtection } from "../agent/context/withoutIdorProtection";

const context: Context = {
  remoteAddress: "::1",
  method: "GET",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
  tenantId: "org_123",
};

const contextWithoutTenantId: Context = {
  remoteAddress: "::1",
  method: "GET",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("IDOR protection for Postgres Pool (pg)", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgres()]);

  const { Pool } = require("pg") as typeof import("pg");
  const pool = new Pool({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cats_pg_idor_pool (
          petname varchar(255),
          tenant_id varchar(255)
      );
    `);
    await pool.query("CREATE TABLE IF NOT EXISTS migrations_pool (id int)");
    await pool.query("TRUNCATE cats_pg_idor_pool");

    await t.test("skips IDOR check when not configured", async () => {
      t.same(
        (
          await runWithContext(context, () => {
            return pool.query("SELECT petname FROM cats_pg_idor_pool");
          })
        ).rows,
        []
      );
    });

    agent.setIdorProtectionConfig({
      tenantColumnName: "tenant_id",
      excludedTables: ["migrations_pool"],
    });

    await t.test("allows query with tenant filter", async () => {
      t.same(
        (
          await runWithContext(context, () => {
            return pool.query(
              "SELECT petname FROM cats_pg_idor_pool WHERE tenant_id = $1",
              ["org_123"]
            );
          })
        ).rows,
        []
      );
    });

    await t.test("blocks query without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return pool.query("SELECT petname FROM cats_pg_idor_pool");
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_pg_idor_pool' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("allows query on excluded table", async () => {
      await runWithContext(context, () => {
        return pool.query("SELECT * FROM migrations_pool");
      });
    });

    await t.test("throws when tenantId is not set", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(contextWithoutTenantId, () => {
          return pool.query("SELECT petname FROM cats_pg_idor_pool");
        });
      });

      if (error instanceof Error) {
        t.match(error.message, "setTenantId() was not called");
      }
    });

    await t.test("blocks query with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return pool.query(
            "SELECT petname FROM cats_pg_idor_pool WHERE tenant_id = $1",
            ["org_456"]
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
        );
      }
    });

    await t.test("allows queries inside withoutIdorProtection", async () => {
      const result = await runWithContext(context, () => {
        return withoutIdorProtection(async () => {
          return await pool.query("SELECT count(*) FROM cats_pg_idor_pool");
        });
      });

      t.ok(result);
    });

    await t.test(
      "blocks query object format without tenant filter",
      async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return pool.query({
              text: "SELECT petname FROM cats_pg_idor_pool",
            });
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen IDOR protection: query on table 'cats_pg_idor_pool' is missing a filter on column 'tenant_id'"
          );
        }
      }
    );

    await t.test("allows query object format with tenant filter", async () => {
      t.same(
        (
          await runWithContext(context, () => {
            return pool.query({
              text: "SELECT petname FROM cats_pg_idor_pool WHERE tenant_id = $1",
              values: ["org_123"],
            });
          })
        ).rows,
        []
      );
    });

    await t.test(
      "allows INSERT with tenant column and correct value",
      async () => {
        await runWithContext(context, () => {
          return pool.query(
            "INSERT INTO cats_pg_idor_pool (petname, tenant_id) VALUES ($1, $2)",
            ["Mittens", "org_123"]
          );
        });
      }
    );

    await t.test("blocks INSERT without tenant column", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return pool.query(
            "INSERT INTO cats_pg_idor_pool (petname) VALUES ($1)",
            ["Mittens"]
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: INSERT on table 'cats_pg_idor_pool' is missing column 'tenant_id'"
        );
      }
    });

    await t.test(
      "Without idor protection works for multiple parallel queries",
      async () => {
        const numberOfQueries = 50;

        const results = await Promise.allSettled(
          Array.from({ length: numberOfQueries }, (_, index) => {
            return runWithContext(context, async () => {
              const sometimesWithoutIdor =
                index % 2 === 0 ? withoutIdorProtection : (fn: any) => fn();

              return await sometimesWithoutIdor(async () => {
                try {
                  await pool.query("SELECT petname FROM cats_pg_idor_pool");
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
              });
            });
          })
        );

        t.equal(results.length, numberOfQueries);

        for (const result of results) {
          t.equal(result.status, "fulfilled");

          if (result.status === "fulfilled") {
            const { index, error } = result.value;

            if (index % 2 === 0) {
              t.ok(!error, `Query ${index} should not have an error`);
            } else {
              t.ok(
                error instanceof Error,
                `Query ${index} should have an error`
              );

              if (error instanceof Error) {
                t.match(
                  error.message,
                  "Zen IDOR protection: query on table 'cats_pg_idor_pool' is missing a filter on column 'tenant_id'"
                );
              }
            }
          }
        }
      }
    );
  } finally {
    await pool.end();
  }
});
