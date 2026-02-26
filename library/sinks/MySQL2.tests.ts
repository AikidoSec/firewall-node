import * as t from "tap";
import { getContext, runWithContext, type Context } from "../agent/Context";
import { MySQL2 } from "./MySQL2";
import { startTestAgent } from "../helpers/startTestAgent";

export function createMySQL2Tests(versionPkgName: string) {
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

  const [major, minor] = versionPkgName.split("-v")[1].split(".").map(Number);

  t.test("it detects SQL injections", async (t) => {
    startTestAgent({
      wrappers: [new MySQL2()],
      rewrite: {
        mysql2: versionPkgName,
      },
    });

    const mysql = require(
      `${versionPkgName}/promise`
    ) as typeof import("mysql2-v3.18/promise");

    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27015,
      multipleStatements: true,
    });

    let connection2:
      | ReturnType<typeof import("mysql2-v3.18").createConnection>
      | undefined;

    try {
      await connection.query(
        `
        CREATE TABLE IF NOT EXISTS cats (
            petname varchar(255)
        );
      `
      );
      await connection.execute("TRUNCATE cats");
      const [rows] = await connection.query("SELECT petname FROM `cats`;");
      t.same(rows, []);
      const [moreRows] = await connection.query({
        sql: "SELECT petname FROM `cats`",
      });
      t.same(moreRows, []);

      const error = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.query("-- should be blocked");
        });
      });
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: mysql2.query(...) originating from body.myTitle"
        );
      }

      const error2 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.query({ sql: "-- should be blocked" });
        });
      });
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Zen has blocked an SQL injection: mysql2.query(...) originating from body.myTitle"
        );
      }

      const error3 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return connection.execute("-- should be blocked");
        });
      });
      if (error3 instanceof Error) {
        t.same(
          error3.message,
          "Zen has blocked an SQL injection: mysql2.execute(...) originating from body.myTitle"
        );
      }

      const error4 = await t.rejects(async () => {
        await runWithContext(
          {
            ...dangerousContext,
            body: {
              myTitle: "1' OR 1=1 -- ",
            },
          },
          () => {
            return connection.prepare(
              "SELECT * FROM cats WHERE petname = '1' OR 1=1 -- '"
            );
          }
        );
      });
      if (error4 instanceof Error) {
        t.same(
          error4.message,
          "Zen has blocked an SQL injection: mysql2.prepare(...) originating from body.myTitle"
        );
      }

      const undefinedQueryError = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          // @ts-expect-error Testing invalid args
          return connection.query(undefined);
        });
      });

      if (undefinedQueryError instanceof Error) {
        t.same(
          undefinedQueryError.message,
          "Cannot read properties of undefined (reading 'constructor')"
        );
      }

      await runWithContext(safeContext, () => {
        return connection.query("-- This is a comment");
      });

      await runWithContext(safeContext, () => {
        return connection.execute("SELECT 1");
      });

      // !!! Do not move this code up
      // Because the connection of mysql2/promises will also be wrapped and possible test failures if only /promise is imported will be hidden
      const mysqlCallback = require(
        versionPkgName
      ) as typeof import("mysql2-v3.18");
      connection2 = mysqlCallback.createConnection({
        host: "localhost",
        user: "root",
        password: "mypassword",
        database: "catsdb",
        port: 27015,
        multipleStatements: true,
      });

      const error5 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return new Promise((resolve, reject) => {
            connection2!.query(
              "-- should be blocked",
              (error: any, results: any) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(results);
                }
              }
            );
          });
        });
      });
      if (error5 instanceof Error) {
        t.same(
          error5.message,
          "Zen has blocked an SQL injection: mysql2.query(...) originating from body.myTitle"
        );
      }

      await runWithContext(dangerousContext, () => {
        return new Promise<void>((resolve) => {
          connection2!.query("SELECT 1", (error: any, results: any) => {
            // Ensure that the context is properly propagated to the callback of mysql2 queries
            t.match(getContext(), {
              remoteAddress: "::1",
              method: "POST",
            });
            resolve();
          });
        });
      });

      runWithContext(safeContext, () => {
        connection2!.query("-- This is a comment");
      });
    } catch (error: any) {
      t.fail(error);
    } finally {
      await connection?.end();

      await new Promise<void>((resolve, reject) => {
        if (!connection2) {
          resolve();
          return;
        }
        connection2.end((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  });

  t.test("it detects SQL injections when using pools", async (t) => {
    startTestAgent({
      wrappers: [new MySQL2()],
      rewrite: {
        mysql2: versionPkgName,
      },
    });

    const mysql = require(
      `${versionPkgName}/promise`
    ) as typeof import("mysql2-v3.18/promise");

    const pool = mysql.createPool({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27015,
      multipleStatements: true,
    });

    try {
      const error1 = await t.rejects(async () => {
        await runWithContext(dangerousContext, async () => {
          return await pool!.query("-- should be blocked");
        });
      });

      t.ok(error1 instanceof Error);
      if (error1 instanceof Error) {
        t.same(
          error1.message,
          "Zen has blocked an SQL injection: mysql2.query(...) originating from body.myTitle"
        );
      }

      const error2 = await t.rejects(async () => {
        await runWithContext(dangerousContext, () => {
          return pool!.execute("-- should be blocked");
        });
      });

      t.ok(error2 instanceof Error);
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Zen has blocked an SQL injection: mysql2.execute(...) originating from body.myTitle"
        );
      }

      // Not possible to fix in old version because of circular dependency issues:
      // https://github.com/sidorares/node-mysql2/pull/3081
      if (major >= 3 && minor >= 12) {
        const error3 = await t.rejects(async () => {
          runWithContext(dangerousContext, () => {
            return pool!.pool.execute("-- should be blocked");
          });
        });

        t.ok(error3 instanceof Error);
        if (error3 instanceof Error) {
          t.same(
            error3.message,
            "Zen has blocked an SQL injection: mysql2.execute(...) originating from body.myTitle"
          );
        }

        const numberOfQueries = 50;

        const results = await Promise.allSettled(
          Array.from({ length: numberOfQueries }, (_, index) => {
            const contextKey = `myKey${index}`;
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
                  await pool.execute(
                    `SELECT id FROM cats WHERE petname = '${injection}'`
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
                `Zen has blocked an SQL injection: mysql2.execute(...) originating from body.myKey${index}`
              );
            }
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
