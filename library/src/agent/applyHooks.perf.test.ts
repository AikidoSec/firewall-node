import * as t from "tap";
import { Agent } from "./Agent";
import { APIForTesting } from "./api/APIForTesting";
import { applyHooks } from "./applyHooks";
import { Context, runWithContext } from "./Context";
import { Hooks } from "./hooks/Hooks";
import { LoggerNoop } from "./logger/LoggerNoop";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: undefined,
  cookies: {},
};

t.test(
  "it stops inspecting method calls when average time was too high",
  async (t) => {
    const hooks = new Hooks();
    const connection = hooks
      .addPackage("mysql2")
      .withVersion("^3.0.0")
      .addSubject((exports) => exports.Connection.prototype);

    let slowCalls = 0;
    connection.inspect("query", () => {
      // SLOW inspection
      for (let i = 0; i < 10000000; i++) {}
      slowCalls++;
    });
    let fastCalls = 0;
    connection.inspect("execute", () => {
      // FAST inspection
      fastCalls++;
    });

    const agent = new Agent(
      true,
      new LoggerNoop(),
      new APIForTesting(),
      undefined,
      true
    );
    t.same(applyHooks(hooks, agent), {
      mysql2: {
        version: "3.9.2",
        supported: true,
      },
    });

    const mysql = require("mysql2/promise");
    const actualConnection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "mypassword",
      database: "catsdb",
      port: 27015,
      multipleStatements: true,
    });

    for (let i = 0; i < 100; i++) {
      await runWithContext(context, () => actualConnection.execute("SELECT 1"));
    }

    for (let i = 0; i < 100; i++) {
      await runWithContext(context, () => actualConnection.query("SELECT 1"));
    }

    t.same(fastCalls, 100);
    t.ok(slowCalls < 100);

    await actualConnection.end();
  }
);
