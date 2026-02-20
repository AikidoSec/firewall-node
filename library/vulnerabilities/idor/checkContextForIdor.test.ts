import * as t from "tap";
import { checkContextForIdor } from "./checkContextForIdor";
import { createTestAgent } from "../../helpers/createTestAgent";
import type { Context } from "../../agent/Context";
import { SQLDialectSQLite } from "../sql-injection/dialects/SQLDialectSQLite";
import { SQLDialectPostgres } from "../sql-injection/dialects/SQLDialectPostgres";

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

const sqlite = new SQLDialectSQLite();
const postgres = new SQLDialectPostgres();

t.test("checkContextForIdor", async (t) => {
  const agent = createTestAgent();
  agent.start([]);

  agent.setIdorProtectionConfig({
    tenantColumnName: "tenant_id",
    excludedTables: [],
  });

  await t.test("blocks when ? placeholder could not be resolved", async () => {
    const result = checkContextForIdor({
      sql: "SELECT * FROM orders WHERE tenant_id = ?",
      context,
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
    const result = checkContextForIdor({
      sql: "SELECT * FROM orders WHERE tenant_id = $1",
      context,
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
      const result = checkContextForIdor({
        sql: "SELECT * FROM orders WHERE tenant_id = ?",
        context,
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
      const result = checkContextForIdor({
        sql: "SELECT * FROM orders WHERE tenant_id = ?",
        context,
        dialect: sqlite,
        resolvePlaceholder: () => "org_123",
      });

      t.equal(result, undefined);
    }
  );

  await t.test(
    "blocks when literal value does not match tenant ID",
    async () => {
      const result = checkContextForIdor({
        sql: "SELECT * FROM orders WHERE tenant_id = 'org_456'",
        context,
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
    const result = checkContextForIdor({
      sql: "SELECT * FROM orders WHERE tenant_id = 'org_123'",
      context,
      dialect: sqlite,
      resolvePlaceholder: () => undefined,
    });

    t.equal(result, undefined);
  });

  await t.test(
    "blocks INSERT when ? placeholder could not be resolved",
    async () => {
      const result = checkContextForIdor({
        sql: "INSERT INTO orders (product, tenant_id) VALUES (?, ?)",
        context,
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
      const result = checkContextForIdor({
        sql: "INSERT INTO orders (product, tenant_id) VALUES (?, ?)",
        context,
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
      const result = checkContextForIdor({
        sql: "INSERT INTO orders (product, tenant_id) VALUES (?, ?)",
        context,
        dialect: sqlite,
        resolvePlaceholder: () => "org_123",
      });

      t.equal(result, undefined);
    }
  );

  await t.test(
    "blocks INSERT when literal value does not match tenant ID",
    async () => {
      const result = checkContextForIdor({
        sql: "INSERT INTO orders (product, tenant_id) VALUES ('Widget', 'org_456')",
        context,
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
      const result = checkContextForIdor({
        sql: "INSERT INTO orders (product, tenant_id) VALUES ('Widget', 'org_123')",
        context,
        dialect: sqlite,
        resolvePlaceholder: () => undefined,
      });

      t.equal(result, undefined);
    }
  );
});
