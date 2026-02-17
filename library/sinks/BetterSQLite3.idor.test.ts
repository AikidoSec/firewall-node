import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { BetterSQLite3 } from "./BetterSQLite3";
import { createTestAgent } from "../helpers/createTestAgent";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
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

t.test("IDOR protection for BetterSQLite3", async (t) => {
  const agent = createTestAgent();
  agent.start([new BetterSQLite3()]);

  let betterSqlite3 = require("better-sqlite3");
  if (isEsmUnitTest()) {
    betterSqlite3 = betterSqlite3.default;
  }
  const db = new betterSqlite3(":memory:");

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cats_idor_sqlite (
          petname varchar(255),
          tenant_id varchar(255)
      );
    `);
    db.exec("CREATE TABLE IF NOT EXISTS migrations (id int)");
    db.exec("DELETE FROM cats_idor_sqlite");

    await t.test("skips IDOR check when not configured", async () => {
      const rows = runWithContext(context, () => {
        return db.prepare("SELECT petname FROM cats_idor_sqlite").all();
      });
      t.same(rows, []);
    });

    agent.setIdorProtectionConfig({
      tenantColumnName: "tenant_id",
      excludedTables: ["migrations"],
    });

    await t.test(
      "allows query with tenant filter using array params",
      async () => {
        const rows = runWithContext(context, () => {
          return db
            .prepare("SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ?")
            .all(["org_123"]);
        });
        t.same(rows, []);
      }
    );

    await t.test(
      "allows query with tenant filter using individual params",
      async () => {
        const rows = runWithContext(context, () => {
          return db
            .prepare("SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ?")
            .all("org_123");
        });
        t.same(rows, []);
      }
    );

    await t.test(
      "blocks query with wrong tenant ID using individual params",
      async () => {
        const error = t.throws(() => {
          runWithContext(context, () => {
            return db
              .prepare(
                "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ?"
              )
              .all("org_456");
          });
        });

        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.match(
            error.message,
            "filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
          );
        }
      }
    );

    await t.test("blocks query without tenant filter", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db.prepare("SELECT petname FROM cats_idor_sqlite").all();
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor_sqlite' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("allows query on excluded table", async () => {
      runWithContext(context, () => {
        return db.prepare("SELECT * FROM migrations").all();
      });
      t.pass();
    });

    await t.test("throws when tenantId is not set", async () => {
      const error = t.throws(() => {
        runWithContext(contextWithoutTenantId, () => {
          return db.prepare("SELECT petname FROM cats_idor_sqlite").all();
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(error.message, "setTenantId() was not called");
      }
    });

    await t.test("blocks query with wrong tenant ID value", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare("SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ?")
            .all(["org_456"]);
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
        );
      }
    });

    await t.test("allows queries inside withoutIdorProtection", async () => {
      const result = runWithContext(context, () => {
        return withoutIdorProtection(() => {
          return db.prepare("SELECT count(*) FROM cats_idor_sqlite").all();
        });
      });

      t.ok(result);
    });

    await t.test(
      "allows INSERT with tenant column and correct value",
      async () => {
        runWithContext(context, () => {
          return db
            .prepare(
              "INSERT INTO cats_idor_sqlite (petname, tenant_id) VALUES (?, ?)"
            )
            .run(["Mittens", "org_123"]);
        });
        t.pass();
      }
    );

    await t.test("blocks INSERT without tenant column", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare("INSERT INTO cats_idor_sqlite (petname) VALUES (?)")
            .run(["Mittens"]);
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: INSERT on table 'cats_idor_sqlite' is missing column 'tenant_id'"
        );
      }
    });

    await t.test("blocks INSERT with wrong tenant ID value", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare(
              "INSERT INTO cats_idor_sqlite (petname, tenant_id) VALUES (?, ?)"
            )
            .run(["Mittens", "org_456"]);
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "INSERT on table 'cats_idor_sqlite' sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
        );
      }
    });

    await t.test(
      "blocks INSERT with wrong tenant ID value without placeholder",
      async () => {
        const error = t.throws(() => {
          runWithContext(context, () => {
            return db
              .prepare(
                "INSERT INTO cats_idor_sqlite (petname, tenant_id) VALUES ('Mittens', 'org_456')"
              )
              .run();
          });
        });

        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.match(
            error.message,
            "INSERT on table 'cats_idor_sqlite' sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
          );
        }
      }
    );

    await t.test("allows UPDATE with tenant filter", async () => {
      runWithContext(context, () => {
        return db
          .prepare(
            "UPDATE cats_idor_sqlite SET petname = ? WHERE tenant_id = ?"
          )
          .run(["Rex", "org_123"]);
      });
      t.pass();
    });

    await t.test("blocks UPDATE without tenant filter", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare("UPDATE cats_idor_sqlite SET petname = ?")
            .run(["Rex"]);
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor_sqlite' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks UPDATE with wrong tenant ID value", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare(
              "UPDATE cats_idor_sqlite SET petname = ? WHERE tenant_id = ?"
            )
            .run(["Rex", "org_456"]);
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
        );
      }
    });

    await t.test("allows DELETE with tenant filter", async () => {
      runWithContext(context, () => {
        return db
          .prepare("DELETE FROM cats_idor_sqlite WHERE tenant_id = ?")
          .run(["org_123"]);
      });
      t.pass();
    });

    await t.test("blocks DELETE without tenant filter", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db.prepare("DELETE FROM cats_idor_sqlite").run();
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor_sqlite' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks DELETE with wrong tenant ID value", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare("DELETE FROM cats_idor_sqlite WHERE tenant_id = ?")
            .run(["org_456"]);
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
        );
      }
    });

    await t.test(
      "does not apply IDOR check for unsupported statements inside withoutIdorProtection",
      async () => {
        const error = t.throws(() => {
          runWithContext(context, () => {
            return withoutIdorProtection(() => {
              return db.exec("UNLOCK TABLES");
            });
          });
        });

        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.notMatch(error.message, /Zen IDOR protection/);
        }
      }
    );

    await t.test("allows DDL statements without tenant filter", async () => {
      runWithContext(context, () => {
        db.exec("CREATE TABLE IF NOT EXISTS temp_idor_test (id int)");
      });
      runWithContext(context, () => {
        db.exec("DROP TABLE IF EXISTS temp_idor_test");
      });
      t.pass();
    });

    await t.test("allows transaction queries", async () => {
      runWithContext(context, () => {
        return db.exec("BEGIN");
      });
      runWithContext(context, () => {
        return db.exec("COMMIT");
      });
      runWithContext(context, () => {
        return db.exec("BEGIN");
      });
      runWithContext(context, () => {
        return db.exec("ROLLBACK");
      });
      t.pass();
    });

    await t.test("allows CTE with tenant filter", async () => {
      const rows = runWithContext(context, () => {
        return db
          .prepare(
            "WITH active AS (SELECT * FROM cats_idor_sqlite WHERE tenant_id = ?) SELECT * FROM active"
          )
          .all(["org_123"]);
      });
      t.same(rows, []);
    });

    await t.test("blocks CTE without tenant filter", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare(
              "WITH active AS (SELECT * FROM cats_idor_sqlite) SELECT * FROM active"
            )
            .all();
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor_sqlite' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks SELECT with tenant filter inside OR", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare(
              "SELECT * FROM cats_idor_sqlite WHERE tenant_id = ? OR petname = ?"
            )
            .all(["org_123", "Mittens"]);
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor_sqlite' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test(
      "allows SELECT with tenant filter in AND around OR",
      async () => {
        const rows = runWithContext(context, () => {
          return db
            .prepare(
              "SELECT * FROM cats_idor_sqlite WHERE tenant_id = ? AND (petname = ? OR petname = ?)"
            )
            .all(["org_123", "Mittens", "Felix"]);
        });
        t.same(rows, []);
      }
    );

    await t.test("blocks UPDATE with tenant filter inside OR", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare(
              "UPDATE cats_idor_sqlite SET petname = ? WHERE tenant_id = ? OR petname = ?"
            )
            .run(["Rex", "org_123", "Mittens"]);
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor_sqlite' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks DELETE with tenant filter inside OR", async () => {
      const error = t.throws(() => {
        runWithContext(context, () => {
          return db
            .prepare(
              "DELETE FROM cats_idor_sqlite WHERE tenant_id = ? OR petname = ?"
            )
            .run(["org_123", "Mittens"]);
        });
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor_sqlite' is missing a filter on column 'tenant_id'"
        );
      }
    });
  } finally {
    db.close();
  }
});
