import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Postgresjs } from "./Postgresjs";
import { createTestAgent } from "../helpers/createTestAgent";
import { withoutIdorProtection } from "../agent/context/withoutIdorProtection";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";

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

t.test("IDOR protection for Postgresjs", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgresjs()]);
  agent.setIdorProtectionConfig({
    tenantColumnName: "tenant_id",
    excludedTables: ["migrations"],
  });

  let postgres = require("postgres") as typeof import("postgres");

  if (isEsmUnitTest()) {
    // @ts-expect-error ESM not covered by types
    postgres = postgres.default;
  }

  const sql = postgres("postgres://root:password@127.0.0.1:27016/main_db");

  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS cats_pgjs_idor (
          petname varchar(255),
          tenant_id varchar(255)
      );
    `);
    await sql.unsafe(
      "CREATE TABLE IF NOT EXISTS migrations (id int)"
    );
    await sql.unsafe("TRUNCATE cats_pgjs_idor");

    await t.test("allows query with tenant filter", async () => {
      await runWithContext(context, () => {
        return sql.unsafe(
          "SELECT petname FROM cats_pgjs_idor WHERE tenant_id = $1",
          ["org_123"]
        );
      });
    });

    await t.test("blocks query without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return sql.unsafe("SELECT petname FROM cats_pgjs_idor");
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_pgjs_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("allows query on excluded table", async () => {
      await runWithContext(context, () => {
        return sql.unsafe("SELECT * FROM migrations");
      });
    });

    await t.test("throws when tenantId is not set", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(contextWithoutTenantId, () => {
          return sql.unsafe("SELECT petname FROM cats_pgjs_idor");
        });
      });

      if (error instanceof Error) {
        t.match(error.message, "setTenantId() was not called");
      }
    });

    await t.test("blocks query with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return sql.unsafe(
            "SELECT petname FROM cats_pgjs_idor WHERE tenant_id = $1",
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
          return sql.unsafe("SELECT count(*) FROM cats_pgjs_idor");
        });
      });

      t.ok(result);
    });

    await t.test("allows INSERT with tenant column and correct value", async () => {
      await runWithContext(context, () => {
        return sql.unsafe(
          "INSERT INTO cats_pgjs_idor (petname, tenant_id) VALUES ($1, $2)",
          ["Mittens", "org_123"]
        );
      });
    });

    await t.test("blocks INSERT without tenant column", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return sql.unsafe(
            "INSERT INTO cats_pgjs_idor (petname) VALUES ($1)",
            ["Mittens"]
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: INSERT on table 'cats_pgjs_idor' is missing column 'tenant_id'"
        );
      }
    });

    await t.test("blocks INSERT with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return sql.unsafe(
            "INSERT INTO cats_pgjs_idor (petname, tenant_id) VALUES ($1, $2)",
            ["Mittens", "org_456"]
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "INSERT on table 'cats_pgjs_idor' sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
        );
      }
    });

    await t.test("allows UPDATE with tenant filter", async () => {
      await runWithContext(context, () => {
        return sql.unsafe(
          "UPDATE cats_pgjs_idor SET petname = $1 WHERE tenant_id = $2",
          ["Rex", "org_123"]
        );
      });
    });

    await t.test("blocks UPDATE without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return sql.unsafe(
            "UPDATE cats_pgjs_idor SET petname = $1",
            ["Rex"]
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_pgjs_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks UPDATE with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return sql.unsafe(
            "UPDATE cats_pgjs_idor SET petname = $1 WHERE tenant_id = $2",
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
        return sql.unsafe(
          "DELETE FROM cats_pgjs_idor WHERE tenant_id = $1",
          ["org_123"]
        );
      });
    });

    await t.test("blocks DELETE without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return sql.unsafe("DELETE FROM cats_pgjs_idor");
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_pgjs_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks DELETE with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return sql.unsafe(
            "DELETE FROM cats_pgjs_idor WHERE tenant_id = $1",
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

    await t.test("skips IDOR check when not configured", async () => {
      agent.setIdorProtectionConfig(undefined!);

      await runWithContext(context, () => {
        return sql.unsafe("SELECT petname FROM cats_pgjs_idor");
      });

      // Restore config
      agent.setIdorProtectionConfig({
        tenantColumnName: "tenant_id",
        excludedTables: ["migrations"],
      });
    });
  } finally {
    await sql.end();
  }
});
