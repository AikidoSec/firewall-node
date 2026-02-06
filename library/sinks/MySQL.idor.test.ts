/* oxlint-disable no-console */
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
    await query("CREATE TABLE IF NOT EXISTS migrations (id int)", connection);
    await query("TRUNCATE cats_idor", connection);

    await t.test("skips IDOR check when not configured", async () => {
      t.same(
        await runWithContext(context, () => {
          return query("SELECT petname FROM cats_idor", connection);
        }),
        []
      );
    });

    agent.setIdorProtectionConfig({
      tenantColumnName: "tenant_id",
      excludedTables: ["migrations"],
    });

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

    await t.test(
      "warns when a non-function is passed to withoutIdorProtection",
      async () => {
        const originalWarn = console.warn;
        const warnings: string[] = [];
        console.warn = (msg: string) => warnings.push(msg);

        try {
          // @ts-expect-error Testing invalid input
          withoutIdorProtection("not a function");

          t.equal(warnings.length, 1);
          t.match(warnings[0], "Expected a function, but received a value");
        } finally {
          console.warn = originalWarn;
        }
      }
    );

    await t.test(
      "warns when sync callback returns a Promise in withoutIdorProtection",
      async () => {
        const originalWarn = console.warn;
        const warnings: string[] = [];
        console.warn = (msg: string) => warnings.push(msg);

        try {
          await runWithContext(context, () => {
            return withoutIdorProtection(() => {
              return query(
                "SELECT petname FROM cats_idor WHERE tenant_id = ?",
                connection,
                ["org_123"]
              );
            });
          });

          t.equal(warnings.length, 1);
          t.match(warnings[0], "returned a Promise without awaiting it");
        } finally {
          console.warn = originalWarn;
        }
      }
    );

    await t.test(
      "does not warn when async callback is used in withoutIdorProtection",
      async () => {
        const originalWarn = console.warn;
        const warnings: string[] = [];
        console.warn = (msg: string) => warnings.push(msg);

        try {
          await runWithContext(context, () => {
            return withoutIdorProtection(async () => {
              return await query(
                "SELECT petname FROM cats_idor WHERE tenant_id = ?",
                connection,
                ["org_123"]
              );
            });
          });

          t.equal(warnings.length, 0);
        } finally {
          console.warn = originalWarn;
        }
      }
    );

    await t.test(
      "blocks query object format without tenant filter",
      async () => {
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
      }
    );

    await t.test(
      "allows INSERT with tenant column and correct value",
      async () => {
        await runWithContext(context, () => {
          return query(
            "INSERT INTO cats_idor (petname, tenant_id) VALUES (?, ?)",
            connection,
            ["Mittens", "org_123"]
          );
        });
      }
    );

    await t.test("blocks INSERT without tenant column", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query(
            "INSERT INTO cats_idor (petname) VALUES (?)",
            connection,
            ["Mittens"]
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: INSERT on table 'cats_idor' is missing column 'tenant_id'"
        );
      }
    });

    await t.test("blocks INSERT with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query(
            "INSERT INTO cats_idor (petname, tenant_id) VALUES (?, ?)",
            connection,
            ["Mittens", "org_456"]
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "INSERT on table 'cats_idor' sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
        );
      }
    });

    await t.test(
      "blocks INSERT with wrong tenant ID value without placeholder",
      async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return query(
              "INSERT INTO cats_idor (petname, tenant_id) VALUES ('Mittens', 'org_456')",
              connection,
              []
            );
          });
        });

        if (error instanceof Error) {
          t.match(
            error.message,
            "INSERT on table 'cats_idor' sets 'tenant_id' to 'org_456' but tenant ID is 'org_123'"
          );
        }
      }
    );

    await t.test("allows UPDATE with tenant filter", async () => {
      await runWithContext(context, () => {
        return query(
          "UPDATE cats_idor SET petname = ? WHERE tenant_id = ?",
          connection,
          ["Rex", "org_123"]
        );
      });
    });

    await t.test("blocks UPDATE without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query("UPDATE cats_idor SET petname = ?", connection, ["Rex"]);
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks UPDATE with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query(
            "UPDATE cats_idor SET petname = ? WHERE tenant_id = ?",
            connection,
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
        return query("DELETE FROM cats_idor WHERE tenant_id = ?", connection, [
          "org_123",
        ]);
      });
    });

    await t.test("blocks DELETE without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query("DELETE FROM cats_idor", connection);
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor' is missing a filter on column 'tenant_id'"
        );
      }
    });

    await t.test("blocks DELETE with wrong tenant ID value", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query(
            "DELETE FROM cats_idor WHERE tenant_id = ?",
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

    await t.test(
      "blocks bulk insert with VALUES ? syntax (use withoutIdorProtection)",
      async () => {
        const error = await t.rejects(async () => {
          await runWithContext(context, () => {
            return query(
              "INSERT INTO cats_idor (petname, tenant_id) VALUES ?",
              connection,
              [
                [
                  ["Mittens", "org_123"],
                  ["Felix", "org_123"],
                ],
              ]
            );
          });
        });

        if (error instanceof Error) {
          t.match(error.message, "Zen IDOR protection");
        }
      }
    );

    await t.test(
      "allows bulk insert with VALUES ? inside withoutIdorProtection",
      async () => {
        await runWithContext(context, () => {
          return withoutIdorProtection(() => {
            return query(
              "INSERT INTO cats_idor (petname, tenant_id) VALUES ?",
              connection,
              [
                [
                  ["Mittens", "org_123"],
                  ["Felix", "org_123"],
                ],
              ]
            );
          });
        });
      }
    );

    await t.test("blocks unsupported statement types", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query("TRUNCATE cats_idor", connection);
        });
      });

      if (error instanceof Error) {
        t.match(error.message, "Unsupported SQL statement type");
      }
    });

    await t.test(
      "allows unsupported statements inside withoutIdorProtection",
      async () => {
        await runWithContext(context, () => {
          return withoutIdorProtection(() => {
            return query("TRUNCATE cats_idor", connection);
          });
        });
      }
    );

    await t.test("allows transaction queries", async () => {
      await runWithContext(context, () => {
        return query("START TRANSACTION", connection);
      });
      await runWithContext(context, () => {
        return query("COMMIT", connection);
      });
      await runWithContext(context, () => {
        return query("BEGIN", connection);
      });
      await runWithContext(context, () => {
        return query("ROLLBACK", connection);
      });
    });

    await t.test("allows CTE with tenant filter", async () => {
      t.same(
        await runWithContext(context, () => {
          return query(
            "WITH active AS (SELECT * FROM cats_idor WHERE tenant_id = ?) SELECT * FROM active",
            connection,
            ["org_123"]
          );
        }),
        []
      );
    });

    await t.test("blocks CTE without tenant filter", async () => {
      const error = await t.rejects(async () => {
        await runWithContext(context, () => {
          return query(
            "WITH active AS (SELECT * FROM cats_idor) SELECT * FROM active",
            connection
          );
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen IDOR protection: query on table 'cats_idor' is missing a filter on column 'tenant_id'"
        );
      }
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
