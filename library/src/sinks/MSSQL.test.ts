import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { APIForTesting, Token } from "../agent/API";
import { LoggerNoop } from "../agent/Logger";
import { runWithContext, type Context } from "../agent/Context";
import { MSSQL } from "./MSSQL";

async function initDb(sql:any) {
    // This creates the cats table
    try {
      await sql.query(`
      CREATE TABLE dbo.cats (
          petname varchar(255)
      );
      `);
    } catch (err) {
      // Ignore errors -> Database already exists
    }
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
t.test("We can hijack Postgres class", async () => {
  const mssql = new MSSQL();
  mssql.wrap();

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

  const sql = require("mssql");
  await sql.connect("Server=localhost,27014;Database=master;User Id=sa;Password=Strongeeeee%Password;Encrypt=false");

  try {
    // Execute 2 queries
    await initDb(sql);
    const cats2 = await sql.query("SELECT petname FROM cats;");

    // @ts-expect-error Private property
    t.same(agent.stats, {
      mssql: {
        blocked: 0,
        total: 2,
        allowed: 2,
        withoutContext: 2,
      },
    });

    const bulkError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return sql.query("-- should be blocked");
      });
    });
    if (bulkError instanceof Error) {
      t.equal(
        bulkError.message,
        "Aikido guard has blocked a SQL injection: -- should be blocked originating from body"
      );
    }

    // @ts-expect-error null is normally not a valid agent
    setInstance(null); // We want to check if the code works when an Agent is not defined.
    await runWithContext(context, () => {
      // Normally this should be detected, but since the agent
      // is not defined we let it through.
      return sql.query("-- should be blocked");
    });
    setInstance(agent); // Put the agent back for the following tests

    const undefinedQueryError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return sql.query(null);
      });
    });
    if (undefinedQueryError instanceof Error) {
      t.equal(
        undefinedQueryError.message,
        "Cannot read property '0' of null"
      );
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
        return sql.query("-- This is a comment");
      }
    );
  } catch (error: any) {
    t.fail(error);
  } finally {
    await sql.close();
  }
});