import * as t from "tap";
import { promisify } from "util";
import { runWithContext, type Context } from "../agent/Context";
import { MySQL } from "./MySQL";
import type { Pool, PoolConnection } from "mysql";
import { createTestAgent } from "../helpers/createTestAgent";

function query(
  sql: string,
  connection: PoolConnection,
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

function getConnectionAndQuery(
  pool: Pool,
  sql: string,
  values?: unknown[]
): Promise<{ connection: PoolConnection; results: unknown }> {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        return reject(error);
      }

      try {
        connection.query(sql, values, (queryError, results) => {
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

const tenant1Context: Context = {
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

const tenant2Context: Context = {
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
  tenantId: "org_456",
};

t.test(
  "IDOR protection survives pool.getConnection() connection reuse across tenants",
  async (t) => {
    const agent = createTestAgent();
    agent.start([new MySQL()]);

    const mysql = require("mysql") as typeof import("mysql");
    const pool = mysql.createPool({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27015,
      connectionLimit: 1,
    });

    const getConnection = promisify(pool.getConnection.bind(pool));

    try {
      const setupConnection = await getConnection();
      await query(
        `
          CREATE TABLE IF NOT EXISTS cats_idor_pool (
              petname varchar(255),
              tenant_id varchar(255)
          );
        `,
        setupConnection
      );
      await query("TRUNCATE cats_idor_pool", setupConnection);
      await query(
        "INSERT INTO cats_idor_pool (petname, tenant_id) VALUES (?, ?)",
        setupConnection,
        ["Mittens", "org_123"]
      );
      setupConnection.release();

      agent.setIdorProtectionConfig({
        tenantColumnName: "tenant_id",
        excludedTables: [],
        requireTenantId: false,
      });

      const tenant1Connection = await runWithContext(tenant1Context, () =>
        getConnection()
      );
      await query(
        "SELECT petname FROM cats_idor_pool WHERE tenant_id = ?",
        tenant1Connection,
        ["org_123"]
      );
      tenant1Connection.release();

      const error = await t.rejects(async () => {
        await runWithContext(tenant2Context, async () => {
          const { connection } = await getConnectionAndQuery(
            pool,
            "SELECT petname FROM cats_idor_pool WHERE tenant_id = ?",
            ["org_123"]
          );

          t.equal(connection.threadId, tenant1Connection.threadId);

          connection.release();
        });
      });

      if (error instanceof Error) {
        t.match(
          error.message,
          "filters 'tenant_id' with value 'org_123' but tenant ID is 'org_456'"
        );
      }
    } finally {
      await promisify(pool.end.bind(pool))();
    }
  }
);
