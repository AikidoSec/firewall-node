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
  const sql = postgres("postgres://root:password@127.0.0.1:27016/main_db");

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

    await t.test("does not inspect tagged templates", async (t) => {
      const rows = await runWithContext(
        context,
        async () => await sql`SELECT petname FROM ${sql(tableName)}`
      );

      t.same(rows, [{ petname: "Fluffy" }]);
    });
  } finally {
    await sql.end();
  }
});
