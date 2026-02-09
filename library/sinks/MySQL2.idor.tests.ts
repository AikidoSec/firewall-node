import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { MySQL2 } from "./MySQL2";
import { startTestAgent } from "../helpers/startTestAgent";
import { withoutIdorProtection } from "../agent/context/withoutIdorProtection";

export function createMySQL2IdorTests(versionPkgName: string) {
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

  t.test("IDOR protection for MySQL2", async (t) => {
    const agent = startTestAgent({
      wrappers: [new MySQL2()],
      rewrite: {
        mysql2: versionPkgName,
      },
    });
    const mysql = require(
      `${versionPkgName}/promise`
    ) as typeof import("mysql2-v3.12/promise");

    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27015,
      multipleStatements: true,
    });

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS cats_idor2 (
            petname varchar(255),
            tenant_id varchar(255)
        );
      `);
      await connection.query("CREATE TABLE IF NOT EXISTS migrations (id int)");
      await connection.query("TRUNCATE cats_idor2");

      await t.test("skips IDOR check when not configured", async () => {
        const [rows] = await runWithContext(context, () => {
          return connection.query("SELECT petname FROM cats_idor2");
        });
        t.same(rows, []);
      });

      agent.setIdorProtectionConfig({
        tenantColumnName: "tenant_id",
        excludedTables: ["migrations"],
      });

      await t.test("allows query with tenant filter", async () => {
        const [rows] = await runWithContext(context, () => {
          return connection.query(
            "SELECT petname FROM cats_idor2 WHERE tenant_id = ?",
            ["org_123"]
          );
        });
        t.same(rows, []);
      });

      await t.test("blocks query without tenant filter", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query("SELECT petname FROM cats_idor2");
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen IDOR protection: query on table 'cats_idor2' is missing a filter on column 'tenant_id'"
          );
        }
      });

      await t.test("allows query on excluded table", async () => {
        await runWithContext(context, () => {
          return connection.query("SELECT * FROM migrations");
        });
      });

      await t.test("throws when tenantId is not set", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(contextWithoutTenantId, () => {
            return connection.query("SELECT petname FROM cats_idor2");
          });
        });

        if (error instanceof Error) {
          t.match(error.message, "setTenantId() was not called");
        }
      });

      await t.test("blocks query with wrong tenant ID value", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query(
              "SELECT petname FROM cats_idor2 WHERE tenant_id = ?",
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
            return connection.query("SELECT count(*) FROM cats_idor2");
          });
        });

        t.ok(result);
      });

      await t.test(
        "blocks query object format without tenant filter",
        async () => {
          const error = await t.rejects(async () => {
            await runWithContext(context, () => {
              return connection.query({
                sql: "SELECT petname FROM cats_idor2",
              });
            });
          });

          if (error instanceof Error) {
            t.match(
              error.message,
              "Zen IDOR protection: query on table 'cats_idor2' is missing a filter on column 'tenant_id'"
            );
          }
        }
      );

      await t.test(
        "allows INSERT with tenant column and correct value",
        async () => {
          await runWithContext(context, () => {
            return connection.query(
              "INSERT INTO cats_idor2 (petname, tenant_id) VALUES (?, ?)",
              ["Mittens", "org_123"]
            );
          });
        }
      );

      await t.test("blocks INSERT without tenant column", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query(
              "INSERT INTO cats_idor2 (petname) VALUES (?)",
              ["Mittens"]
            );
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen IDOR protection: INSERT on table 'cats_idor2' is missing column 'tenant_id'"
          );
        }
      });

      await t.test("blocks INSERT with wrong tenant ID value", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query(
              "INSERT INTO cats_idor2 (petname, tenant_id) VALUES (?, ?)",
              ["Mittens", "org_456"]
            );
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "INSERT on table 'cats_idor2' sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
          );
        }
      });

      await t.test(
        "blocks INSERT with wrong tenant ID value without placeholder",
        async () => {
          const error = await t.rejects(async () => {
            await runWithContext(context, () => {
              return connection.query(
                "INSERT INTO cats_idor2 (petname, tenant_id) VALUES ('Mittens', 'org_456')",
                []
              );
            });
          });

          if (error instanceof Error) {
            t.match(
              error.message,
              "INSERT on table 'cats_idor2' sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
            );
          }
        }
      );

      await t.test("allows UPDATE with tenant filter", async () => {
        await runWithContext(context, () => {
          return connection.query(
            "UPDATE cats_idor2 SET petname = ? WHERE tenant_id = ?",
            ["Rex", "org_123"]
          );
        });
      });

      await t.test("blocks UPDATE without tenant filter", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query("UPDATE cats_idor2 SET petname = ?", [
              "Rex",
            ]);
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen IDOR protection: query on table 'cats_idor2' is missing a filter on column 'tenant_id'"
          );
        }
      });

      await t.test("blocks UPDATE with wrong tenant ID value", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query(
              "UPDATE cats_idor2 SET petname = ? WHERE tenant_id = ?",
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
          return connection.query(
            "DELETE FROM cats_idor2 WHERE tenant_id = ?",
            ["org_123"]
          );
        });
      });

      await t.test("blocks DELETE without tenant filter", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query("DELETE FROM cats_idor2");
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen IDOR protection: query on table 'cats_idor2' is missing a filter on column 'tenant_id'"
          );
        }
      });

      await t.test("blocks DELETE with wrong tenant ID value", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query(
              "DELETE FROM cats_idor2 WHERE tenant_id = ?",
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

      await t.test("allows TRUNCATE statement", async () => {
        await runWithContext(context, () => {
          return connection.query("TRUNCATE cats_idor2");
        });
      });

      await t.test("blocks unsupported statement types", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query("ANALYZE TABLE cats_idor2");
          });
        });

        if (error instanceof Error) {
          t.match(error.message, "Unrecognized SQL statement");
        }
      });

      await t.test(
        "allows unsupported statements inside withoutIdorProtection",
        async () => {
          await runWithContext(context, () => {
            return withoutIdorProtection(() => {
              return connection.query("TRUNCATE cats_idor2");
            });
          });
        }
      );

      await t.test("allows transaction queries", async () => {
        await runWithContext(context, () => {
          return connection.query("START TRANSACTION");
        });
        await runWithContext(context, () => {
          return connection.query("COMMIT");
        });
        await runWithContext(context, () => {
          return connection.query("BEGIN");
        });
        await runWithContext(context, () => {
          return connection.query("ROLLBACK");
        });
      });

      await t.test("allows CTE with tenant filter", async () => {
        const [rows] = await runWithContext(context, () => {
          return connection.query(
            "WITH active AS (SELECT * FROM cats_idor2 WHERE tenant_id = ?) SELECT * FROM active",
            ["org_123"]
          );
        });
        t.same(rows, []);
      });

      await t.test("blocks CTE without tenant filter", async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return connection.query(
              "WITH active AS (SELECT * FROM cats_idor2) SELECT * FROM active"
            );
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen IDOR protection: query on table 'cats_idor2' is missing a filter on column 'tenant_id'"
          );
        }
      });
    } finally {
      await connection.end();
    }
  });
}
