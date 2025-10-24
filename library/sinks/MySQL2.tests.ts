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

  t.test("it detects SQL injections", async (t) => {
    startTestAgent({
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

    let connection2:
      | ReturnType<typeof import("mysql2-v3.12").createConnection>
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
      ) as typeof import("mysql2-v3.12");
      connection2 = mysqlCallback.createConnection({
        host: "localhost",
        user: "root",
        password: "mypassword",
        database: "catsdb",
        port: 27015,
        multipleStatements: true,
      });

      const error3 = await t.rejects(async () => {
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
      if (error3 instanceof Error) {
        t.same(
          error3.message,
          "Zen has blocked an SQL injection: mysql2.query(...) originating from body.myTitle"
        );
      }

      runWithContext(safeContext, () => {
        connection2!.query("-- This is a comment");
      });

      await runWithContext(dangerousContext, () => {
        return new Promise<void>((resolve) => {
          connection2!.query("SELECT petname FROM cats;", () => {
            t.same(getContext(), dangerousContext);
            resolve();
          });
        });
      });
    } catch (error: any) {
      t.fail(error);
    } finally {
      await connection.end();

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
}
