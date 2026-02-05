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

t.test("IDOR protection for Postgres (pg)", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgres()]);

  const { Client } = require("pg") as typeof import("pg");
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
      CREATE TABLE IF NOT EXISTS cats_pg_idor (
          petname varchar(255),
          tenant_id varchar(255)
      );
    `);
    await client.query("CREATE TABLE IF NOT EXISTS migrations (id int)");
    await client.query("TRUNCATE cats_pg_idor");

    await t.test("skips IDOR check when not configured", async () => {
      t.same(
        (
          await runWithContext(context, () => {
            return client.query("SELECT petname FROM cats_pg_idor");
          })
        ).rows,
        []
      );
    });

    agent.setIdorProtectionConfig({
      tenantColumnName: "tenant_id",
      excludedTables: ["migrations"],
    });

    await t.test("allows query with tenant filter", async () => {
      t.same(
        (
          await runWithContext(context, () => {
            return client.query(
              "SELECT petname FROM cats_pg_idor WHERE tenant_id = $1",
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
          return client.query("SELECT petname FROM cats_pg_idor");
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_pg_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("allows query on excluded table", async () => {
      await runWithContext(context, () => {
        return client.query("SELECT * FROM migrations");
      });
    });

    await t.test("throws when tenantId is not set", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(contextWithoutTenantId, () => {
          return client.query("SELECT petname FROM cats_pg_idor");
        });
      });

      if (error instanceof Error) {
        t.match(error.message, "setTenantId() was not called");
      }
    });

    await t.test("blocks query with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return client.query(
            "SELECT petname FROM cats_pg_idor WHERE tenant_id = $1",
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
        return withoutIdorProtection(() => {
          return client.query("SELECT count(*) FROM cats_pg_idor");
        });
      });

      t.ok(result);
    });

    await t.test(
      "blocks query object format without tenant filter",
      async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return client.query({ text: "SELECT petname FROM cats_pg_idor" });
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen IDOR protection: query on table 'cats_pg_idor' is missing a filter on column 'tenant_id'"
          );
        }
      }
    );

    await t.test("allows query object format with tenant filter", async () => {
      t.same(
        (
          await runWithContext(context, () => {
            return client.query({
              text: "SELECT petname FROM cats_pg_idor WHERE tenant_id = $1",
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
          return client.query(
            "INSERT INTO cats_pg_idor (petname, tenant_id) VALUES ($1, $2)",
            ["Mittens", "org_123"]
          );
        });
      }
    );

    await t.test("blocks INSERT without tenant column", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return client.query(
            "INSERT INTO cats_pg_idor (petname) VALUES ($1)",
            ["Mittens"]
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: INSERT on table 'cats_pg_idor' is missing column 'tenant_id'"
        );
      }
    });

    await t.test("blocks INSERT with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return client.query(
            "INSERT INTO cats_pg_idor (petname, tenant_id) VALUES ($1, $2)",
            ["Mittens", "org_456"]
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "INSERT on table 'cats_pg_idor' sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
        );
      }
    });

    await t.test(
      "blocks INSERT with wrong tenant ID value without placeholder",
      async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return client.query(
              "INSERT INTO cats_pg_idor (petname, tenant_id) VALUES ('Mittens', 'org_456')",
              []
            );
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "INSERT on table 'cats_pg_idor' sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
          );
        }
      }
    );

    await t.test("allows UPDATE with tenant filter", async () => {
      await runWithContext(context, () => {
        return client.query(
          "UPDATE cats_pg_idor SET petname = $1 WHERE tenant_id = $2",
          ["Rex", "org_123"]
        );
      });
    });

    await t.test("blocks UPDATE without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return client.query("UPDATE cats_pg_idor SET petname = $1", ["Rex"]);
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_pg_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks UPDATE with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return client.query(
            "UPDATE cats_pg_idor SET petname = $1 WHERE tenant_id = $2",
            ["Rex", "org_456"]
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

    await t.test("allows DELETE with tenant filter", async () => {
      await runWithContext(context, () => {
        return client.query("DELETE FROM cats_pg_idor WHERE tenant_id = $1", [
          "org_123",
        ]);
      });
    });

    await t.test("blocks DELETE without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return client.query("DELETE FROM cats_pg_idor");
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_pg_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks DELETE with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return client.query("DELETE FROM cats_pg_idor WHERE tenant_id = $1", [
            "org_456",
          ]);
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
        );
      }
    });

    await t.test("blocks unsupported statement types", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return client.query("TRUNCATE cats_pg_idor");
        });
      });

      if (error instanceof Error) {
        t.match(error.message, "Unsupported SQL statement type");
      }
    });

    await t.test(
      "allows unsupported statements inside withoutIdorProtection",
      async () => {
        await runWithContext(context, () => {
          return withoutIdorProtection(() => {
            return client.query("TRUNCATE cats_pg_idor");
          });
        });
      }
    );

    await t.test("allows transaction queries", async () => {
      await runWithContext(context, () => {
        return client.query("START TRANSACTION");
      });
      await runWithContext(context, () => {
        return client.query("COMMIT");
      });
      await runWithContext(context, () => {
        return client.query("BEGIN");
      });
      await runWithContext(context, () => {
        return client.query("ROLLBACK");
      });
    });

    await t.test("allows CTE with tenant filter", async () => {
      t.same(
        (
          await runWithContext(context, () => {
            return client.query(
              "WITH active AS (SELECT * FROM cats_pg_idor WHERE tenant_id = $1) SELECT * FROM active",
              ["org_123"]
            );
          })
        ).rows,
        []
      );
    });

    await t.test("blocks CTE without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return client.query(
            "WITH active AS (SELECT * FROM cats_pg_idor) SELECT * FROM active"
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_pg_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });
  } finally {
    await client.end();
  }
});
