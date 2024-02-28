import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Token } from "../agent/api/Token";
import { applyHooks } from "../agent/applyHooks";
import { runWithContext, type Context } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { MySQL } from "./MySQL";
import type { Connection } from "mysql";

function query(sql: string, connection: Connection) {
  return new Promise((resolve, reject) => {
    connection.query(sql, (error, results) => {
      if (error) {
        return reject(error);
      }

      resolve(results);
    });
  });
}

async function initDb(connection: Connection) {
  // This creates the cats table
  await query(
    `
      CREATE TABLE IF NOT EXISTS cats (
          petname varchar(255)
      );
    `,
    connection
  );
}

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `-- should be blocked`,
  },
  cookies: {},
};

t.test("it inspects query method calls and blocks if needed", async () => {
  const hooks = new Hooks();
  new MySQL().wrap(hooks);
  applyHooks(hooks);

  const mysql = require("mysql");
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    new Token("123"),
    false,
    {}
  );
  agent.start();
  setInstance(agent);

  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
    multipleStatements: true,
  });

  try {
    // Execute 2 queries
    await initDb(connection);
    t.same(await query("SELECT petname FROM `cats`;", connection), []);

    // @ts-expect-error Private property
    t.same(agent.stats, {
      mysql: {
        blocked: 0,
        total: 2,
        allowed: 2,
        withoutContext: 2,
      },
    });

    const bulkError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return connection.query("-- should be blocked");
      });
    });

    if (bulkError instanceof Error) {
      t.equal(
        bulkError.message,
        "Aikido guard has blocked a SQL injection: -- should be blocked originating from body"
      );
    }

    setInstance(null); // We want to check if the code works when an Agent is not defined.
    await runWithContext(context, () => {
      // Normally this should be detected, but since the agent
      // is not defined we let it through.
      return query("-- should be blocked", connection);
    });
    setInstance(agent); // Put the agent back for the following tests

    const undefinedQueryError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return query("", connection);
      });
    });

    if (undefinedQueryError instanceof Error) {
      t.match(undefinedQueryError.message, /Query was empty/);
    }

    await runWithContext(
      {
        remoteAddress: "::1",
        method: "POST",
        url: "http://localhost:4000/",
        query: {},
        headers: {},
        body: {},
        cookies: {},
      },
      () => {
        return connection.query("-- This is a comment");
      }
    );
  } catch (error: any) {
    t.fail(error);
  } finally {
    await connection.end();
  }
});
