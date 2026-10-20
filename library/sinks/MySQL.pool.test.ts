import * as t from "tap";
import { promisify } from "util";
import { runWithContext, type Context } from "../agent/Context";
import { MySQL } from "./MySQL";
import type { Pool, PoolConnection } from "mysql";
import { createTestAgent } from "../helpers/createTestAgent";

function getConnectionAndQuery(
  pool: Pool,
  sql: string
): Promise<{ connection: PoolConnection; results: unknown }> {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        return reject(error);
      }

      try {
        connection.query(sql, (queryError, results) => {
          if (queryError) {
            connection.release();
            return reject(queryError);
          }

          resolve({ connection, results });
        });
      } catch (syncError) {
        connection.release();
        reject(syncError);
      }
    });
  });
}

const openerContext: Context = {
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

const attackerContext: Context = {
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

t.test(
  "SQL injection detection survives pool.getConnection() connection reuse",
  async (t) => {
    const agent = createTestAgent();
    agent.start([new MySQL()]);

    const mysql = require("mysql") as typeof import("mysql");

    const controlPool = mysql.createPool({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27015,
      connectionLimit: 1,
    });

    try {
      const controlError = await t.rejects(async () => {
        await runWithContext(attackerContext, () => {
          return getConnectionAndQuery(controlPool, "-- should be blocked");
        });
      });

      if (controlError instanceof Error) {
        t.match(
          controlError.message,
          "Zen has blocked an SQL injection: MySQL.query(...) originating from body.myTitle"
        );
      }
    } finally {
      await promisify(controlPool.end.bind(controlPool))();
    }

    const pool = mysql.createPool({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27015,
      connectionLimit: 1,
    });

    try {
      const { connection: openerConnection } = await runWithContext(
        openerContext,
        () => getConnectionAndQuery(pool, "SELECT 1")
      );
      openerConnection.release();

      const error = await t.rejects(async () => {
        await runWithContext(attackerContext, async () => {
          const { connection } = await getConnectionAndQuery(
            pool,
            "-- should be blocked"
          );

          t.equal(connection.threadId, openerConnection.threadId);

          connection.release();
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen has blocked an SQL injection: MySQL.query(...) originating from body.myTitle"
        );
      }
    } finally {
      await promisify(pool.end.bind(pool))();
    }
  }
);
