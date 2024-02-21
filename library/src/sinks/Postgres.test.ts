import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { APIForTesting, Token } from "../agent/API";
import { LoggerNoop } from "../agent/Logger";
import { Context, runWithContext } from "../agent/Context";
import { Postgres } from "./Postgres";

async function initDb(client) {
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
/*
    await runWithContext(
      {
        remoteAddress: "::1",
        method: "POST",
        url: "http://localhost:4000",
        query: {},
        headers: {},
        body: {},
        cookies: {},
      },
      () => {
        return collection.find({ title: { $ne: null } }).toArray();
      }
    );*/
  } catch (error: any) {
    //t.fail(error.message);
  } finally {
    //await client.close();
  }
});
