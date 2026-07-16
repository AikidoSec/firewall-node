import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { MariaDB } from "./MariaDB";
import { startTestAgent } from "../helpers/startTestAgent";

export async function createMariadbTests(versionPkgName: string) {
  const dangerousContext: Context = {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: {
      myTitle: `-- should be blocked`,
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };

  const safeContext: Context = {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000/",
    query: {},
    headers: {},
    body: {},
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };

  t.before(() => {
    startTestAgent({
      wrappers: [new MariaDB()],
      rewrite: {
        mariadb: versionPkgName,
      },
    });
  });

  const mariadb = require(versionPkgName) as typeof import("mariadb-v3.5");

  t.test("it detects SQL injections", async (t) => {
    const pool = mariadb.createPool({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27018,
      connectionLimit: 5,
    });

    const connection = await pool.getConnection();

    try {
      await connection.query(
        `
        CREATE TABLE IF NOT EXISTS cats (
            petname varchar(255)
        );
      `
      );
      await connection.execute("TRUNCATE cats");

      t.same(await connection.query("SELECT petname FROM `cats`;"), []);
      t.same(
        await connection.query({ sql: "SELECT petname FROM `cats`;" }),
        []
      );
      t.same(await pool.query("SELECT petname FROM `cats`;"), []);
      t.same(await pool.query({ sql: "SELECT petname FROM `cats`;" }), []);

      const queryStream = connection.queryStream("SELECT petname FROM `cats`;");
      const streamResult = [];
      for await (const row of queryStream) {
        streamResult.push(row);
      }
      t.same(streamResult, []);

      const error = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.query("-- should be blocked");
        });
      });
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: mariadb.query(...) originating from body.myTitle"
        );
      }

      const poolError = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return pool.execute({ sql: "-- should be blocked" });
        });
      });
      if (poolError instanceof Error) {
        t.same(
          poolError.message,
          "Zen has blocked an SQL injection: mariadb.execute(...) originating from body.myTitle"
        );
      }

      const error2 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.execute({ sql: "-- should be blocked" });
        });
      });
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Zen has blocked an SQL injection: mariadb.execute(...) originating from body.myTitle"
        );
      }

      const error3 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return pool.query({ sql: "-- should be blocked" });
        });
      });
      if (error3 instanceof Error) {
        t.same(
          error3.message,
          "Zen has blocked an SQL injection: mariadb.query(...) originating from body.myTitle"
        );
      }

      const error4 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.batch("-- should be blocked", []);
        });
      });
      if (error4 instanceof Error) {
        t.same(
          error4.message,
          "Zen has blocked an SQL injection: mariadb.batch(...) originating from body.myTitle"
        );
      }

      const error5 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.prepare("-- should be blocked");
        });
      });
      if (error5 instanceof Error) {
        t.same(
          error5.message,
          "Zen has blocked an SQL injection: mariadb.prepare(...) originating from body.myTitle"
        );
      }

      const error6 = await t.rejects(async () => {
        runWithContext(dangerousContext, () => {
          return connection.queryStream("-- should be blocked");
        });
      });
      if (error6 instanceof Error) {
        t.same(
          error6.message,
          "Zen has blocked an SQL injection: mariadb.queryStream(...) originating from body.myTitle"
        );
      }

      const undefinedQueryError = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          // @ts-expect-error Testing undefined query
          return connection.query(undefined);
        });
      });

      if (undefinedQueryError instanceof Error) {
        t.match(undefinedQueryError.message, "sql parameter is mandatory");
      }

      await runWithContext(safeContext, () => {
        return connection.query("-- This is a comment");
      });

      await runWithContext(safeContext, () => {
        return connection.execute("SELECT 1");
      });
    } catch (error: any) {
      t.fail(error);
    } finally {
      await connection.end();
      await pool.end();
    }
  });

  const mariadbCallback = require(
    `${versionPkgName}/callback.js`
  ) as typeof import("mariadb-v3.5/callback");

  t.test("it detects SQL injections using callbacks", (t) => {
    const pool = mariadbCallback.createPool({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27018,
      connectionLimit: 5,
    });

    pool.query("SELECT 1", (err: any, rows: any) => {
      t.same(err, null);
      t.same(rows, [{ 1: 1 }]);
    });

    pool.getConnection((err: any, connection: any) => {
      t.same(err, null);

      try {
        connection.query(
          `
          CREATE TABLE IF NOT EXISTS cats (
              petname varchar(255)
          );
        `,
          (err: Error | null, meta: any, rows: unknown[]) => {
            t.same(err, null);
            t.same(rows, []);
            t.match(meta, {
              affectedRows: 0,
            });
            t.same(Number(meta.insertId), 0);
            connection.execute("TRUNCATE cats");

            try {
              runWithContext(dangerousContext, () => {
                pool.query("-- should be blocked", () => {
                  t.fail("Should not be called");
                });
                t.fail("Should not be called");
              });
            } catch (error) {
              t.ok(error instanceof Error);
              if (error instanceof Error) {
                t.same(
                  error.message,
                  "Zen has blocked an SQL injection: mariadb.query(...) originating from body.myTitle"
                );
              }
            }

            try {
              runWithContext(dangerousContext, () => {
                connection.query("-- should be blocked", () => {
                  t.fail("Should not be called");
                });
                t.fail("Should not be called");
              });
            } catch (error) {
              t.ok(error instanceof Error);
              if (error instanceof Error) {
                t.same(
                  error.message,
                  "Zen has blocked an SQL injection: mariadb.query(...) originating from body.myTitle"
                );
              }
            }

            try {
              runWithContext(dangerousContext, () => {
                connection.execute("-- should be blocked", () => {
                  t.fail("Should not be called");
                });
                t.fail("Should not be called");
              });
            } catch (error) {
              t.ok(error instanceof Error);
              if (error instanceof Error) {
                t.same(
                  error.message,
                  "Zen has blocked an SQL injection: mariadb.execute(...) originating from body.myTitle"
                );
              }
            }

            connection.end();

            pool.end(() => {
              t.end();
            });
          }
        );
      } catch (error: any) {
        t.fail(error);
      }
    });
  });

  t.test("it works without a pool", async (t) => {
    const connection = await mariadb.createConnection({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27018,
    });

    try {
      await connection.query(
        `
        CREATE TABLE IF NOT EXISTS cats (
            petname varchar(255)
        );
      `
      );
      await connection.execute("TRUNCATE cats");

      t.same(await connection.query("SELECT petname FROM `cats`;"), []);
      t.same(
        await connection.query({ sql: "SELECT petname FROM `cats`;" }),
        []
      );

      const queryStream = connection.queryStream("SELECT petname FROM `cats`;");
      const streamResult = [];
      for await (const row of queryStream) {
        streamResult.push(row);
      }
      t.same(streamResult, []);

      const error = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.query("-- should be blocked");
        });
      });
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: mariadb.query(...) originating from body.myTitle"
        );
      }

      const error2 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.execute({ sql: "-- should be blocked" });
        });
      });
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Zen has blocked an SQL injection: mariadb.execute(...) originating from body.myTitle"
        );
      }

      const error4 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.batch("-- should be blocked", []);
        });
      });
      if (error4 instanceof Error) {
        t.same(
          error4.message,
          "Zen has blocked an SQL injection: mariadb.batch(...) originating from body.myTitle"
        );
      }

      const error5 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.prepare("-- should be blocked");
        });
      });
      if (error5 instanceof Error) {
        t.same(
          error5.message,
          "Zen has blocked an SQL injection: mariadb.prepare(...) originating from body.myTitle"
        );
      }

      const error6 = await t.rejects(async () => {
        runWithContext(dangerousContext, () => {
          return connection.queryStream("-- should be blocked");
        });
      });
      if (error6 instanceof Error) {
        t.same(
          error6.message,
          "Zen has blocked an SQL injection: mariadb.queryStream(...) originating from body.myTitle"
        );
      }

      const undefinedQueryError = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          // @ts-expect-error Testing undefined query
          return connection.query(undefined);
        });
      });

      if (undefinedQueryError instanceof Error) {
        t.match(undefinedQueryError.message, "sql parameter is mandatory");
      }

      await runWithContext(safeContext, () => {
        return connection.query("-- This is a comment");
      });

      await runWithContext(safeContext, () => {
        return connection.execute("SELECT 1");
      });
    } catch (error: any) {
      t.fail(error);
    } finally {
      await connection.end();
    }
  });

  t.test("it works with simultaneous queries", async (t) => {
    const pool = mariadb.createPool({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27018,
      connectionLimit: 5,
    });

    const numberOfQueries = 50;

    try {
      const results = await Promise.allSettled(
        Array.from({ length: numberOfQueries }, (_, index) => {
          const contextKey = `myTitle${index}`;
          const injection = `abc' OR 1=1; -- should be blocked ${index}`;

          return runWithContext(
            {
              remoteAddress: "::1",
              method: "POST",
              url: "http://localhost:4000",
              query: {},
              headers: {},
              body: {
                [contextKey]: injection,
              },
              cookies: {},
              routeParams: {},
              source: "hono",
              route: "/posts/:id",
            },
            async () => {
              try {
                await pool.query(
                  `SELECT id FROM users_pgpool WHERE name = '${injection}'`
                );
                return {
                  index,
                  error: null,
                };
              } catch (error: any) {
                return {
                  index,
                  error,
                };
              }
            }
          );
        })
      );

      t.equal(results.length, numberOfQueries);

      for (const result of results) {
        t.equal(result.status, "fulfilled");

        if (result.status === "fulfilled") {
          const { index, error } = result.value;
          t.ok(error instanceof Error);

          if (error instanceof Error) {
            t.same(
              error.message,
              `Zen has blocked an SQL injection: mariadb.query(...) originating from body.myTitle${index}`
            );
          }
        }
      }
    } catch (error: any) {
      t.fail(error);
    } finally {
      await pool.end();
    }
  });
}
