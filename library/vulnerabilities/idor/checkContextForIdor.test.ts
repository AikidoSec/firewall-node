import * as t from "tap";
import { checkContextForIdor } from "./checkContextForIdor";
import { createTestAgent } from "../../helpers/createTestAgent";
import { runWithContext, type Context } from "../../agent/Context";
import { SQLDialectSQLite } from "../sql-injection/dialects/SQLDialectSQLite";
import { SQLDialectPostgres } from "../sql-injection/dialects/SQLDialectPostgres";
import { SQLDialectMySQL } from "../sql-injection/dialects/SQLDialectMySQL";

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
  route: "/orders",
  tenantId: "org_123",
};

const contextWithoutTenantId: Context = { ...context, tenantId: undefined };

const sqlite = new SQLDialectSQLite();
const postgres = new SQLDialectPostgres();
const mysql = new SQLDialectMySQL();

// Runs the check inside a request that has the tenant set.
function check(
  args: Parameters<typeof checkContextForIdor>[0]
): ReturnType<typeof checkContextForIdor> {
  return runWithContext(context, () => checkContextForIdor(args));
}

t.test("checkContextForIdor", async (t) => {
  const agent = createTestAgent();
  agent.start([]);

  agent.setIdorProtectionConfig({
    tenantColumnName: "tenant_id",
    excludedTables: [],
    requireTenantId: false,
  });

  await t.test("blocks when ? placeholder could not be resolved", async () => {
    const result = check({
      sql: "SELECT * FROM orders WHERE tenant_id = ?",
      dialect: sqlite,
      resolvePlaceholder: () => undefined,
    });

    t.ok(result);
    t.match(
      result?.message,
      "has a placeholder for 'tenant_id' that could not be resolved"
    );
  });

  await t.test("blocks when $1 placeholder could not be resolved", async () => {
    const result = check({
      sql: "SELECT * FROM orders WHERE tenant_id = $1",
      dialect: postgres,
      resolvePlaceholder: () => undefined,
    });

    t.ok(result);
    t.match(
      result?.message,
      "has a placeholder for 'tenant_id' that could not be resolved"
    );
  });

  await t.test(
    "blocks when resolved placeholder value does not match tenant ID",
    async () => {
      const result = check({
        sql: "SELECT * FROM orders WHERE tenant_id = ?",
        dialect: sqlite,
        resolvePlaceholder: () => "org_456",
      });

      t.ok(result);
      t.match(
        result?.message,
        "filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
      );
    }
  );

  await t.test(
    "allows when resolved placeholder value matches tenant ID",
    async () => {
      const result = check({
        sql: "SELECT * FROM orders WHERE tenant_id = ?",
        dialect: sqlite,
        resolvePlaceholder: () => "org_123",
      });

      t.equal(result, undefined);
    }
  );

  await t.test(
    "blocks when literal value does not match tenant ID",
    async () => {
      const result = check({
        sql: "SELECT * FROM orders WHERE tenant_id = 'org_456'",
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      });

      t.ok(result);
      t.match(
        result?.message,
        "filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
      );
    }
  );

  await t.test("allows when literal value matches tenant ID", async () => {
    const result = check({
      sql: "SELECT * FROM orders WHERE tenant_id = 'org_123'",
      dialect: sqlite,
      resolvePlaceholder: () => undefined,
    });

    t.equal(result, undefined);
  });

  await t.test(
    "allows join where tenant column is filtered via column-to-column comparison",
    async () => {
      // The join ties orders.tenant_id to audits.tenant_id, so filtering one
      // also restricts the other. Zen should resolve orders.tenant_id from the
      // filter on audits.tenant_id and allow the query.
      const result = check({
        sql: "SELECT o.* FROM orders o JOIN audits a ON o.tenant_id = a.tenant_id WHERE a.tenant_id = 'org_123'",
        dialect: postgres,
        resolvePlaceholder: () => undefined,
      });

      t.equal(result, undefined);
    }
  );

  await t.test(
    "blocks join when column-to-column resolved tenant ID does not match",
    async () => {
      const result = check({
        sql: "SELECT o.* FROM orders o JOIN audits a ON o.tenant_id = a.tenant_id WHERE a.tenant_id = 'org_456'",
        dialect: postgres,
        resolvePlaceholder: () => undefined,
      });

      t.ok(result);
      t.match(
        result?.message,
        "filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
      );
    }
  );

  await t.test(
    "blocks INSERT when ? placeholder could not be resolved",
    async () => {
      const result = check({
        sql: "INSERT INTO orders (product, tenant_id) VALUES (?, ?)",
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      });

      t.ok(result);
      t.match(
        result?.message,
        "has a placeholder for 'tenant_id' that could not be resolved"
      );
    }
  );

  await t.test(
    "blocks INSERT when resolved placeholder does not match tenant ID",
    async () => {
      const result = check({
        sql: "INSERT INTO orders (product, tenant_id) VALUES (?, ?)",
        dialect: sqlite,
        resolvePlaceholder: () => "org_456",
      });

      t.ok(result);
      t.match(
        result?.message,
        "sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
      );
    }
  );

  await t.test(
    "allows INSERT when resolved placeholder matches tenant ID",
    async () => {
      const result = check({
        sql: "INSERT INTO orders (product, tenant_id) VALUES (?, ?)",
        dialect: sqlite,
        resolvePlaceholder: () => "org_123",
      });

      t.equal(result, undefined);
    }
  );

  await t.test(
    "blocks INSERT when literal value does not match tenant ID",
    async () => {
      const result = check({
        sql: "INSERT INTO orders (product, tenant_id) VALUES ('Widget', 'org_456')",
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      });

      t.ok(result);
      t.match(
        result?.message,
        "sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
      );
    }
  );

  await t.test(
    "allows INSERT when literal value matches tenant ID",
    async () => {
      const result = check({
        sql: "INSERT INTO orders (product, tenant_id) VALUES ('Widget', 'org_123')",
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      });

      t.equal(result, undefined);
    }
  );

  await t.test("cache is not reused across dialects", async () => {
    const postgresResult = check({
      sql: "SELECT * FROM orders WHERE tenant_id = $1",
      dialect: postgres,
      resolvePlaceholder: () => "org_123",
    });
    t.equal(
      postgresResult,
      undefined,
      "postgres: allowed when $1 resolves to tenant ID"
    );

    const mysqlResult = check({
      sql: "SELECT * FROM orders WHERE tenant_id = $1",
      dialect: mysql,
      resolvePlaceholder: () => "org_123",
    });
    t.ok(
      mysqlResult,
      "mysql: blocked because $1 is a literal, not a placeholder"
    );
  });

  await t.test("blocks a request without a tenant", async () => {
    const result = runWithContext(contextWithoutTenantId, () =>
      checkContextForIdor({
        sql: "SELECT * FROM orders WHERE tenant_id = 'org_123'",
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      })
    );

    t.ok(result);
    t.match(
      result?.message,
      "query on table 'orders' requires a tenant ID, but setTenantId() was not called"
    );
  });

  await t.test(
    "allows a request without a tenant if it only touches excluded tables",
    async () => {
      agent.setIdorProtectionConfig({
        tenantColumnName: "tenant_id",
        excludedTables: ["migrations"],
        requireTenantId: false,
      });

      const result = runWithContext(contextWithoutTenantId, () =>
        checkContextForIdor({
          sql: "SELECT * FROM migrations",
          dialect: sqlite,
          resolvePlaceholder: () => undefined,
        })
      );

      t.equal(result, undefined);
    }
  );

  await t.test(
    "blocks a request without a tenant and lists every table that needs one",
    async () => {
      agent.setIdorProtectionConfig({
        tenantColumnName: "tenant_id",
        excludedTables: ["migrations"],
        requireTenantId: false,
      });

      const result = runWithContext(contextWithoutTenantId, () =>
        checkContextForIdor({
          sql: "SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id JOIN migrations m ON m.id = o.migration_id",
          dialect: sqlite,
          resolvePlaceholder: () => undefined,
        })
      );

      t.ok(result);
      t.match(
        result?.message,
        "query on tables 'orders, customers' requires a tenant ID"
      );
    }
  );

  await t.test("shortens a long table list with '...'", async () => {
    const result = runWithContext(contextWithoutTenantId, () =>
      checkContextForIdor({
        sql: "SELECT * FROM a JOIN b ON true JOIN c ON true JOIN d ON true JOIN e ON true JOIN f ON true",
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      })
    );

    t.ok(result);
    t.match(result?.message, "query on tables 'a, b, c, d, e, ...' requires");
  });

  await t.test(
    "skips a query with no tenant outside a request by default",
    async () => {
      const result = checkContextForIdor({
        sql: "SELECT * FROM orders WHERE tenant_id = 'org_123'",
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      });

      t.equal(result, undefined);
    }
  );

  await t.test(
    "blocks a query with no tenant outside a request when requireTenantId is enabled",
    async () => {
      agent.setIdorProtectionConfig({
        tenantColumnName: "tenant_id",
        excludedTables: [],
        requireTenantId: true,
      });

      const result = checkContextForIdor({
        sql: "SELECT * FROM orders WHERE tenant_id = 'org_123'",
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      });

      t.ok(result);
      t.match(
        result?.message,
        "query on table 'orders' requires a tenant ID, but setTenantId() was not called"
      );

      // Restore the default (no enforcement) for any later tests.
      agent.setIdorProtectionConfig({
        tenantColumnName: "tenant_id",
        excludedTables: [],
        requireTenantId: false,
      });
    }
  );

  await t.test(
    "still skips a query with requireTenantId enabled if it only touches excluded tables",
    async () => {
      agent.setIdorProtectionConfig({
        tenantColumnName: "tenant_id",
        excludedTables: ["migrations"],
        requireTenantId: true,
      });

      const result = checkContextForIdor({
        sql: "SELECT * FROM migrations",
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      });

      t.equal(result, undefined);
    }
  );
});
