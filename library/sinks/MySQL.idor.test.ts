import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { MySQL } from "./MySQL";
import type { Connection } from "mysql";
import { createTestAgent } from "../helpers/createTestAgent";
import { withoutIdorProtection } from "../agent/context/withoutIdorProtection";

function query(
  sql: string,
  connection: Connection,
  values?: unknown[]
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    connection.query(sql, values, (error, results) => {
      if (error) {
        return reject(error);
      }

      resolve(results);
    });
  });
}

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

t.test("IDOR protection for MySQL", async (t) => {
  const agent = createTestAgent();
  agent.start([new MySQL()]);
  agent.setIdorProtectionConfig({
    tenantColumnName: "tenant_id",
    excludedTables: ["migrations"],
  });

  const mysql = require("mysql") as typeof import("mysql");
  const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
    multipleStatements: true,
  });

  try {
    await query(
      `
        CREATE TABLE IF NOT EXISTS cats_idor (
            petname varchar(255),
            tenant_id varchar(255)
        );
      `,
      connection
    );
    await query(
      "CREATE TABLE IF NOT EXISTS migrations (id int)",
      connection
    );
    await query("TRUNCATE cats_idor", connection);

    await t.test("allows query with tenant filter", async () => {
      t.same(
        await runWithContext(context, () => {
          return query(
            "SELECT petname FROM cats_idor WHERE tenant_id = ?",
            connection,
            ["org_123"]
          );
        }),
        []
      );
    });

    await t.test("blocks query without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query("SELECT petname FROM cats_idor", connection);
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("allows query on excluded table", async () => {
      await runWithContext(context, () => {
        return query("SELECT * FROM migrations", connection);
      });
    });

    await t.test("throws when tenantId is not set", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(contextWithoutTenantId, () => {
          return query("SELECT petname FROM cats_idor", connection);
        });
      });

      if (error instanceof Error) {
        t.match(error.message, "setTenantId() was not called");
      }
    });

    await t.test("blocks query with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query(
            "SELECT petname FROM cats_idor WHERE tenant_id = ?",
            connection,
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
          return query("SELECT count(*) FROM cats_idor", connection);
        });
      });

      t.ok(result);
    });

    await t.test("blocks query object format without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return new Promise((resolve, reject) => {
            connection.query(
              { sql: "SELECT petname FROM cats_idor" },
              (err, results) => {
                if (err) {
                  return reject(err);
                }
                resolve(results);
              }
            );
          });
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("skips IDOR check when not configured", async () => {
      agent.setIdorProtectionConfig(undefined!);

      t.same(
        await runWithContext(context, () => {
          return query("SELECT petname FROM cats_idor", connection);
        }),
        []
      );

      // Restore config
      agent.setIdorProtectionConfig({
        tenantColumnName: "tenant_id",
        excludedTables: ["migrations"],
      });
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      connection.end((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      })
    );
  }
});
