import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { withoutIdorProtection } from "../agent/context/withoutIdorProtection";
import { isPackageInstalled } from "../helpers/isPackageInstalled";
import { NodeSQLite } from "./NodeSQLite";

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

t.test(
  "IDOR protection for NodeSQLite",
  {
    skip: !isPackageInstalled("node:sqlite")
      ? "node:sqlite not available"
      : false,
  },
  async (t) => {
    const agent = createTestAgent();
    agent.start([new NodeSQLite()]);

    const { DatabaseSync } =
      require("node:sqlite") as typeof import("node:sqlite");

    const db = new DatabaseSync(":memory:");

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
        "allows query with tenant filter using individual params",
        async () => {
          const row = runWithContext(context, () => {
            return db
              .prepare(
                "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ?"
              )
              .get({}, "org_123");
          });
          t.equal(row, undefined);
        }
      );

      await t.test(
        "allows query with tenant filter using named params",
        async () => {
          const row = runWithContext(context, () => {
            return db
              .prepare(
                "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = :tenant_id"
              )
              .get({ tenant_id: "org_123" });
          });
          t.equal(row, undefined);
        }
      );

      await t.test(
        "allows query with tenant filter using named params with prefixed key",
        async () => {
          const row = runWithContext(context, () => {
            return db
              .prepare(
                "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = :tenant_id"
              )
              .get({ ":tenant_id": "org_123" });
          });
          t.equal(row, undefined);
        }
      );

      await t.test(
        "throws error for query with tenant filter using named params with wrong prefixed key",
        async () => {
          const error = t.throws(() => {
            runWithContext(context, () => {
              return db
                .prepare(
                  "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = :tenant_id"
                )
                .get({ "!tenant_id": "org_123" });
            });
          });

          t.ok(error instanceof Error);
          if (error instanceof Error) {
            t.match(
              error.message,
              "query on table 'cats_idor_sqlite' has a placeholder for 'tenant_id' that could not be resolved"
            );
          }
        }
      );

      await t.test(
        "allows query with tenant filter using named param with @ prefix",
        async () => {
          const row = runWithContext(context, () => {
            return db
              .prepare(
                "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = @tenant_id"
              )
              .get({ tenant_id: "org_123" });
          });
          t.equal(row, undefined);
        }
      );

      await t.test(
        "allows query with tenant filter using named param with $ prefix",
        async () => {
          const row = runWithContext(context, () => {
            return db
              .prepare(
                "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = $tenant_id"
              )
              .get({ tenant_id: "org_123" });
          });
          t.equal(row, undefined);
        }
      );

      await t.test(
        "allows query with hardcoded tenant ID in prepare",
        async () => {
          const row = runWithContext(context, () => {
            return db
              .prepare(
                "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = 'org_123'"
              )
              .get();
          });
          t.equal(row, undefined);
        }
      );

      await t.test("allows query with tenant filter using exec", async () => {
        await runWithContext(context, async () => {
          return db.exec(
            "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = 'org_123'"
          );
        });
      });

      await t.test(
        "blocks query with wrong tenant ID using named param",
        async () => {
          const error = t.throws(() => {
            runWithContext(context, () => {
              return db
                .prepare(
                  "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = :tenant_id"
                )
                .get({ tenant_id: "org_456" });
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

      await t.test("blocks query with wrong tenant ID using exec", async () => {
        const error = t.throws(() => {
          runWithContext(context, () => {
            return db.exec(
              "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = 'org_456'"
            );
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

      await t.test("blocks query with no tenant ID in context", async () => {
        const error = t.throws(() => {
          runWithContext(contextWithoutTenantId, () => {
            return db.exec(
              "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = 'org_456'"
            );
          });
        });

        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.match(
            error.message,
            "setTenantId() was not called for this request. Every request must have a tenant ID when IDOR protection is enabled."
          );
        }
      });

      await t.test(
        "blocks query with wrong tenant ID using anonymous param",
        async () => {
          const error = t.throws(() => {
            runWithContext(context, () => {
              return db
                .prepare(
                  "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ?"
                )
                .get({}, "org_456");
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

      await t.test(
        "blocks query with wrong tenant ID using anonymous param",
        async () => {
          const error = t.throws(() => {
            runWithContext(context, () => {
              return (
                db
                  .prepare(
                    "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ?"
                  )
                  // @ts-expect-error Testing behavior with invalid args
                  .get(undefined, "org_456")
              );
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

      await t.test(
        "blocks query with wrong tenant ID hardcoded in prepare",
        async () => {
          const error = t.throws(() => {
            runWithContext(context, () => {
              return db
                .prepare(
                  "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = 'org_456'"
                )
                .get();
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

      await t.test(
        "blocks query without tenant ID when tenant ID is required",
        async () => {
          const error = t.throws(() => {
            runWithContext(context, () => {
              return db.prepare("SELECT petname FROM cats_idor_sqlite").get();
            });
          });

          t.ok(error instanceof Error);
          if (error instanceof Error) {
            t.match(
              error.message,
              "query on table 'cats_idor_sqlite' is missing a filter on column 'tenant_id'"
            );
          }
        }
      );

      await t.test(
        "blocks query when placeholder can not be resolved",
        async () => {
          const error = t.throws(() => {
            runWithContext(context, () => {
              return db
                .prepare(
                  "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ?"
                )
                .get();
            });
          });

          t.ok(error instanceof Error);
          if (error instanceof Error) {
            t.match(
              error.message,
              "query on table 'cats_idor_sqlite' has a placeholder for 'tenant_id' that could not be resolved"
            );
          }
        }
      );

      await t.test(
        "does not block query when IDOR protection is disabled",
        async () => {
          runWithContext(context, () => {
            withoutIdorProtection(() => {
              return db
                .prepare(
                  "SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ?"
                )
                .get();
            });
          });
        }
      );

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

      await t.test("blocks UPDATE without tenant filter", async () => {
        const error = t.throws(() => {
          runWithContext(context, () => {
            return db
              .prepare("UPDATE cats_idor_sqlite SET petname = ?")
              .run("Fluffy");
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

      // Not supported in some Node.js versions
      if (typeof db.createTagStore === "function") {
        const tagStore = db.createTagStore();

        await t.test("allows tagged query with no context", async () => {
          const result = tagStore.get`SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ${"org_123"}`;
          t.same(result, undefined);
        });

        await t.test(
          "allows tagged query with tenant filter using template literal",
          async () => {
            runWithContext(context, () => {
              const result = tagStore.get`SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ${"org_123"}`;
              t.same(result, undefined);
            });
          }
        );

        await t.test(
          "blocks tagged query with wrong tenant ID using template literal",
          async () => {
            const error = t.throws(() => {
              runWithContext(context, () => {
                const _r = tagStore.get`SELECT petname FROM cats_idor_sqlite WHERE tenant_id = ${"org_456"}`;
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

        await t.test(
          "blocks tagged query with wrong tenant ID using template literal with multiple placeholders",
          async () => {
            const error = t.throws(() => {
              runWithContext(context, () => {
                const _r = tagStore.get`SELECT petname FROM cats_idor_sqlite WHERE petname = ${"Fluffy"} AND tenant_id = ${"org_456"}`;
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

        await t.test(
          "query fails when tenant ID placeholder can not be resolved in tagged query",
          async () => {
            const error = t.throws(() => {
              runWithContext(context, () => {
                const _r = tagStore.get(
                  // @ts-expect-error Testing behavior with invalid args
                  [
                    "SELECT petname FROM cats_idor_sqlite WHERE petname = ",
                    " AND tenant_id = ",
                    "",
                  ],
                  "org_456"
                );
              });
            });

            t.ok(error instanceof Error);
            if (error instanceof Error) {
              t.match(error.message, "incomplete input");
            }
          }
        );

        await t.test(
          "blocks tagged query with unresolved named tenant placeholder",
          async () => {
            const error = t.throws(() => {
              runWithContext(context, () => {
                const _r = tagStore.get`SELECT petname FROM cats_idor_sqlite WHERE tenant_id = :tenant_id`;
              });
            });

            t.ok(error instanceof Error);
            if (error instanceof Error) {
              t.match(
                error.message,
                "query on table 'cats_idor_sqlite' has a placeholder for 'tenant_id' that could not be resolved"
              );
            }
          }
        );

        await t.test("blocks query with no tenant ID in context", async () => {
          const error = t.throws(() => {
            runWithContext(contextWithoutTenantId, () => {
              return tagStore.all`SELECT petname FROM cats_idor_sqlite WHERE tenant_id = 'org_456'`;
            });
          });

          t.ok(error instanceof Error);
          if (error instanceof Error) {
            t.match(
              error.message,
              "setTenantId() was not called for this request. Every request must have a tenant ID when IDOR protection is enabled."
            );
          }
        });

        await t.test(
          "blocks query with hardcoded wrong tenant ID in tagged query",
          async () => {
            const error = t.throws(() => {
              runWithContext(context, () => {
                return tagStore.all`SELECT petname FROM cats_idor_sqlite WHERE tenant_id = 'org_456'`;
              });
            });

            t.ok(error instanceof Error);
            if (error instanceof Error) {
              t.match(
                error.message,
                "query on table 'cats_idor_sqlite' filters 'tenant_id' with value 'org_456' but tenant ID is 'org_123'"
              );
            }
          }
        );
      }
    } catch (error: any) {
      t.fail(error);
    } finally {
      db.close();
    }
  }
);
