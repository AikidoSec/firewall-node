import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Token } from "../agent/api/Token";
import { applyHooks } from "../agent/applyHooks";
import { runWithContext, type Context } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { MySQL2 } from "./MySQL2";

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
  new MySQL2().wrap(hooks);
  applyHooks(hooks);

  const mysql = require("mysql2/promise");
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

    // @ts-expect-error Private property
    t.same(agent.stats, {
      mysql2: {
        blocked: 0,
        total: 3,
        allowed: 3,
        withoutContext: 3,
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
      return connection.query("-- should be blocked");
    });
    setInstance(agent); // Put the agent back for the following tests

    const undefinedQueryError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return connection.query(undefined);
      });
    });

    if (undefinedQueryError instanceof Error) {
      t.same(
        undefinedQueryError.message,
        "Cannot read properties of undefined (reading 'constructor')"
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
        return connection.query("-- This is a comment");
      }
    );
  } catch (error: any) {
    t.fail(error);
  } finally {
    await connection.end();
  }
});
