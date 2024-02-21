import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { APIForTesting, Token } from "../agent/API";
import { LoggerNoop } from "../agent/Logger";
import { runWithContext, type Context } from "../agent/Context";
import { Postgres } from "./Postgres";
import type { Client } from "pg";

async function initDb(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
    );
    `);
}

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `'OR 1=1--`,
  },
  cookies: {},
};
t.test("We can hijack Postgres class", async () => {
  const postgres = new Postgres();
  postgres.wrap();
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

  const { Client } = require("pg");
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
  });
  await client.connect();

  try {
    // Execute 2 queries
    await initDb(client);
    const cats2 = await client.query("SELECT petname FROM cats;");
    // @ts-expect-error Private property
    t.same(agent.stats, {
      postgres: {
        blocked: 0,
        total: 2,
        allowed: 2,
        withoutContext: 2,
      },
    });

    const bulkError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query("'OR 1=1--");
      });
    });
    if (bulkError instanceof Error) {
      t.equal(
        bulkError.message,
        "Aikido guard has blocked a SQL injection: 'OR 1=1-- originating from body"
      );
    }
    // @ts-ignore
    setInstance(null); // We want to check if the code works when an Agent is not defined.
    await runWithContext(context, () => {
      // Normally this should be detected, but since the agent
      // is not defined we let it through.
      return client.query("'OR 1=1--");
    });
    setInstance(agent); // Put the agent back for the following tests
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
        return client.query("-- This is a comment");
      }
    );
  } catch (error: any) {
    t.fail(error);
  } finally {
    await client.end();
  }
});
