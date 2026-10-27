import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { checkContextForSqlInjectionAndIdor } from "./checkContextForSqlInjectionAndIdor";
import { SQLDialectPostgres } from "./sql-injection/dialects/SQLDialectPostgres";

const dialect = new SQLDialectPostgres();

const payload = "1' -- ";

const context: Context = {
  remoteAddress: "::1",
  method: "GET",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: { id: payload },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/orders",
  tenantId: "org_123",
};

const cleanContext: Context = { ...context, body: {} };

const sqlInjection = `SELECT * FROM orders WHERE tenant_id = 'org_123' AND id = '${payload}'`;
const sqlInjectionWithoutTenantFilter = `SELECT * FROM orders WHERE id = '${payload}'`;
const safeQuery = "SELECT * FROM orders WHERE tenant_id = 'org_123'";
const safeQueryWithoutTenantFilter = "SELECT * FROM orders WHERE id = 1";

function check(sql: string, ctx: Context | undefined) {
  const run = () =>
    checkContextForSqlInjectionAndIdor({
      sql,
      operation: "pg.query",
      context: ctx,
      dialect,
      resolvePlaceholder: () => undefined,
    });

  return ctx ? runWithContext(ctx, run) : run();
}

function startAgent(block: boolean) {
  const agent = createTestAgent({ block });
  agent.start([]);
  agent.setIdorProtectionConfig({
    tenantColumnName: "tenant_id",
    excludedTables: [],
    requireTenantId: false,
  });
}

t.test("blocking mode", async (t) => {
  startAgent(true);

  t.test("returns nothing for a safe query with a tenant filter", async (t) => {
    t.same(check(safeQuery, cleanContext), undefined);
  });

  t.test("returns the SQL injection result", async (t) => {
    t.match(check(sqlInjection, context), {
      kind: "sql_injection",
      operation: "pg.query",
    });
  });

  t.test(
    "prefers the SQL injection result over an IDOR violation",
    async (t) => {
      t.match(check(sqlInjectionWithoutTenantFilter, context), {
        kind: "sql_injection",
      });
    }
  );

  t.test("returns the IDOR violation for a safe query", async (t) => {
    t.match(check(safeQueryWithoutTenantFilter, cleanContext), {
      idorViolation: true,
    });
  });
});

t.test("detection-only mode", async (t) => {
  startAgent(false);

  t.test("returns nothing for a safe query with a tenant filter", async (t) => {
    t.same(check(safeQuery, cleanContext), undefined);
  });

  t.test(
    "returns the SQL injection result if the IDOR check passes",
    async (t) => {
      t.match(check(sqlInjection, context), {
        kind: "sql_injection",
        operation: "pg.query",
      });
    }
  );

  t.test(
    "returns the IDOR violation even if SQL injection was detected",
    async (t) => {
      const result = check(sqlInjectionWithoutTenantFilter, context);
      t.match(result, {
        idorViolation: true,
        attack: { kind: "sql_injection", operation: "pg.query" },
      });
      t.match(
        (result as { message: string }).message,
        "missing a filter on column 'tenant_id'"
      );
    }
  );

  t.test("returns the IDOR violation for a safe query", async (t) => {
    t.match(check(safeQueryWithoutTenantFilter, cleanContext), {
      idorViolation: true,
    });
  });
});

t.test("without a request context", async (t) => {
  startAgent(true);

  t.test("skips the SQL injection check", async (t) => {
    t.same(check(sqlInjection, undefined), undefined);
  });
});
