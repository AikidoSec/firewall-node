import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
import { Postgresjs } from "./Postgresjs";

const tenantId = "org_123";
const tableName = "cats_postgresjs_idor";

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
  route: "/cats",
  tenantId,
};

t.test("IDOR protection for Postgres.js sql.unsafe", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgresjs()]);

  const postgresModule = require("postgres") as typeof import("postgres") & {
    default?: typeof import("postgres");
  };
  const postgres = isEsmUnitTest()
    ? (postgresModule.default as typeof import("postgres"))
    : postgresModule;
  const sql = postgres("postgres://root:****@127.0.0.1:27016/main_db");

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql(tableName)} (
        petname varchar(255),
        tenant_id varchar(255)
      )
    `;
    await sql`TRUNCATE ${sql(tableName)}`;
    await sql`
      INSERT INTO ${sql(tableName)} (petname, tenant_id)
      VALUES (${"Fluffy"}, ${tenantId})
    `;

    agent.setIdorProtectionConfig({
      tenantColumnName: "tenant_id",
      excludedTables: [],
      requireTenantId: false,
    });

    await t.test("allows a matching tenant parameter", async (t) => {
      const rows = await runWithContext(
        context,
        async () =>
          await sql.unsafe(
            `SELECT petname FROM ${tableName} WHERE petname = $1 AND tenant_id = $2`,
            ["Fluffy", tenantId]
          )
      );

      t.same(rows, [{ petname: "Fluffy" }]);
    });

    await t.test("blocks a different tenant parameter", async (t) => {
      await t.rejects(
        runWithContext(
          context,
          async () =>
            await sql.unsafe(
              `SELECT petname FROM ${tableName} WHERE petname = $1 AND tenant_id = $2`,
              ["Fluffy", "org_456"]
            )
        ),
        {
          message:
            "Zen IDOR protection: query on table 'cats_postgresjs_idor' filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'",
        }
      );
    });

    await t.test("blocks a missing tenant filter", async (t) => {
      await t.rejects(
        runWithContext(
          context,
          async () => await sql.unsafe(`SELECT petname FROM ${tableName}`)
        ),
        {
          message:
            "Zen IDOR protection: query on table 'cats_postgresjs_idor' is missing a filter on column 'tenant_id'",
        }
      );
    });

    await t.test("inspects tagged templates", async (t) => {
      await t.rejects(
        runWithContext(
          context,
          async () => await sql`SELECT petname FROM ${sql(tableName)}`
        ),
        {
          message:
            "Zen IDOR protection: query on table 'cats_postgresjs_idor' is missing a filter on column 'tenant_id'",
        }
      );
    });

    await t.test("allows tagged templates with matching tenant", async (t) => {
      const rows = await runWithContext(
        context,
        async () =>
          await sql`SELECT petname FROM ${sql(tableName)} WHERE tenant_id = ${tenantId}`
      );

      t.same(rows, [{ petname: "Fluffy" }]);
    });

    await t.test("blocks tagged templates with different tenant", async (t) => {
      await t.rejects(
        runWithContext(
          context,
          async () =>
            await sql`SELECT petname FROM ${sql(tableName)} WHERE tenant_id = ${"org_456"}`
        ),
        {
          message:
            "Zen IDOR protection: query on table 'cats_postgresjs_idor' filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'",
        }
      );
    });

    await t.test(
      "blocks tagged template UPDATE without tenant filter",
      async (t) => {
        await t.rejects(
          runWithContext(
            context,
            async () =>
              await sql`UPDATE ${sql(tableName)} SET petname = ${"NewName"}`
          ),
          {
            message:
              "Zen IDOR protection: query on table 'cats_postgresjs_idor' is missing a filter on column 'tenant_id'",
          }
        );
      }
    );

    await t.test(
      "allows tagged template UPDATE with matching tenant filter",
      async (t) => {
        await runWithContext(
          context,
          async () =>
            await sql`UPDATE ${sql(tableName)} SET petname = ${"NewName"} WHERE tenant_id = ${tenantId}`
        );
        t.pass("UPDATE with matching tenant filter allowed");
      }
    );

    await t.test(
      "blocks tagged template DELETE without tenant filter",
      async (t) => {
        await t.rejects(
          runWithContext(
            context,
            async () => await sql`DELETE FROM ${sql(tableName)}`
          ),
          {
            message:
              "Zen IDOR protection: query on table 'cats_postgresjs_idor' is missing a filter on column 'tenant_id'",
          }
        );
      }
    );

    await t.test(
      "allows tagged template DELETE with matching tenant filter",
      async (t) => {
        await runWithContext(
          context,
          async () =>
            await sql`DELETE FROM ${sql(tableName)} WHERE tenant_id = ${tenantId} AND petname = ${"NonExistent"}`
        );
        t.pass("DELETE with matching tenant filter allowed");
      }
    );

    await t.test(
      "blocks tagged template with complex query missing tenant",
      async (t) => {
        await t.rejects(
          runWithContext(
            context,
            async () =>
              await sql`SELECT petname FROM ${sql(tableName)} WHERE petname LIKE ${"F%"} ORDER BY petname`
          ),
          {
            message:
              "Zen IDOR protection: query on table 'cats_postgresjs_idor' is missing a filter on column 'tenant_id'",
          }
        );
      }
    );

    await t.test(
      "allows tagged template with complex query and matching tenant",
      async (t) => {
        const rows = await runWithContext(
          context,
          async () =>
            await sql`SELECT petname FROM ${sql(tableName)} WHERE tenant_id = ${tenantId} AND petname LIKE ${"F%"} ORDER BY petname`
        );
        t.same(rows, [{ petname: "Fluffy" }]);
      }
    );

    await t.test(
      "blocks tagged template with parameterized table identifier and no tenant",
      async (t) => {
        await t.rejects(
          runWithContext(
            context,
            async () =>
              await sql`SELECT * FROM ${sql(tableName)} WHERE petname = ${"Fluffy"}`
          ),
          {
            message:
              "Zen IDOR protection: query on table 'cats_postgresjs_idor' is missing a filter on column 'tenant_id'",
          }
        );
      }
    );

    await t.test(
      "blocks tagged template with wrong tenant in complex WHERE clause",
      async (t) => {
        await t.rejects(
          runWithContext(
            context,
            async () =>
              await sql`SELECT petname FROM ${sql(tableName)} WHERE (tenant_id = ${"org_456"} OR tenant_id = ${"org_789"})`
          ),
          {
            message:
              "Zen IDOR protection: query on table 'cats_postgresjs_idor' filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'",
          }
        );
      }
    );

    await t.test(
      "verifies both sql`` and sql.unsafe are protected",
      async (t) => {
        // Test that sql.unsafe is still protected
        await t.rejects(
          runWithContext(
            context,
            async () =>
              await sql.unsafe(`SELECT petname FROM ${tableName}`)
          ),
          {
            message:
              "Zen IDOR protection: query on table 'cats_postgresjs_idor' is missing a filter on column 'tenant_id'",
          }
        );

        // Test that tagged template is also protected
        await t.rejects(
          runWithContext(
            context,
            async () => await sql`SELECT petname FROM ${sql(tableName)}`
          ),
          {
            message:
              "Zen IDOR protection: query on table 'cats_postgresjs_idor' is missing a filter on column 'tenant_id'",
          }
        );

        t.pass("Both sql`` and sql.unsafe are protected");
      }
    );

    await t.test(
      "blocks tagged template cross-tenant read attempt",
      async (t) => {
        // This simulates the exact exploit scenario: authenticated user trying to read another tenant's data
        const attackerTenantId = "org_456";
        const victimTenantId = "org_123";

        // Insert a record for the victim tenant
        await sql`INSERT INTO ${sql(tableName)} (petname, tenant_id) VALUES (${"VictimCat"}, ${victimTenantId})`;

        // Attacker context with different tenant
        const attackerContext: Context = {
          ...context,
          tenantId: attackerTenantId,
        };

        // Attempt to read victim's data using tagged template (the vulnerability scenario)
        await t.rejects(
          runWithContext(
            attackerContext,
            async () =>
              await sql`SELECT petname FROM ${sql(tableName)} WHERE tenant_id = ${victimTenantId}`
          ),
          {
            message:
              "Zen IDOR protection: query on table 'cats_postgresjs_idor' filters 'tenant_id' with value 'org_123' but tenant ID is 'org_456'",
          }
        );

        // Verify attacker can only read their own (non-existent) data
        const attackerRows = await runWithContext(
          attackerContext,
          async () =>
            await sql`SELECT petname FROM ${sql(tableName)} WHERE tenant_id = ${attackerTenantId}`
        );
        t.same(attackerRows, [], "Attacker cannot see victim's data");
      }
    );

    await t.test(
      "blocks tagged template cross-tenant write attempt",
      async (t) => {
        const attackerTenantId = "org_456";
        const victimTenantId = "org_123";

        const attackerContext: Context = {
          ...context,
          tenantId: attackerTenantId,
        };

        // Attempt to modify victim's data using tagged template
        await t.rejects(
          runWithContext(
            attackerContext,
            async () =>
              await sql`UPDATE ${sql(tableName)} SET petname = ${"Hacked"} WHERE tenant_id = ${victimTenantId}`
          ),
          {
            message:
              "Zen IDOR protection: query on table 'cats_postgresjs_idor' filters 'tenant_id' with value 'org_123' but tenant ID is 'org_456'",
          }
        );

        // Verify victim's data is unchanged
        const victimRows = await runWithContext(
          context,
          async () =>
            await sql`SELECT petname FROM ${sql(tableName)} WHERE tenant_id = ${victimTenantId}`
        );
        t.ok(
          victimRows.some((row: any) => row.petname === "Fluffy"),
          "Victim's data remains unchanged"
        );
      }
    );
  } finally {
    await sql.end();
  }
});
