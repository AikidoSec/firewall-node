import * as t from "tap";
import { Agent } from "./Agent";
import { ReportingAPIForTesting } from "./api/ReportingAPIForTesting";
import { Token } from "./api/Token";
import { applyHooks } from "./applyHooks";
import { Context, runWithContext } from "./Context";
import { Hooks } from "./hooks/Hooks";
import { LoggerForTesting } from "./logger/LoggerForTesting";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: undefined,
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

function createAgent() {
  const logger = new LoggerForTesting();
  const api = new ReportingAPIForTesting();
  const agent = new Agent(true, logger, api, new Token("123"), "lambda");

  return {
    agent,
    logger,
    api,
  };
}

t.test("it ignores if package is not installed", async (t) => {
  const hooks = new Hooks();
  hooks.addPackage("unknown").withVersion("^1.0.0");

  const { agent } = createAgent();
  t.same(applyHooks(hooks, agent), {});
});

t.test("it ignores if packages have empty selectors", async (t) => {
  const hooks = new Hooks();
  hooks.addPackage("shell-quote").withVersion("^1.0.0");

  const { agent } = createAgent();
  t.same(applyHooks(hooks, agent), {
    "shell-quote": {
      version: "1.8.1",
      supported: false,
    },
  });
});

t.test("it ignores unknown selectors", async (t) => {
  const hooks = new Hooks();
  hooks
    .addPackage("shell-quote")
    .withVersion("^1.0.0")
    .addSubject((exports) => exports.doesNotExist)
    .inspect("method", () => {});

  const { agent } = createAgent();
  t.same(applyHooks(hooks, agent), {
    "shell-quote": {
      version: "1.8.1",
      supported: true,
    },
  });

  // Force require to load shell-quote
  require("shell-quote");
});

t.test("it tries to wrap method that does not exist", async (t) => {
  const hooks = new Hooks();
  hooks
    .addPackage("shell-quote")
    .withVersion("^1.0.0")
    .addSubject((exports) => exports)
    .inspect("does_not_exist", () => {})
    .modifyArguments("another_method_that_does_not_exist", (args) => {
      return args;
    })
    .inspectResult("another_second_method_that_does_not_exist", () => {});

  const { agent, logger } = createAgent();
  t.same(applyHooks(hooks, agent), {
    "shell-quote": {
      version: "1.8.1",
      supported: true,
    },
  });

  t.same(logger.getMessages(), [
    "Failed to wrap method another_second_method_that_does_not_exist in module shell-quote",
    "Failed to wrap method another_method_that_does_not_exist in module shell-quote",
    "Failed to wrap method does_not_exist in module shell-quote",
  ]);
});

t.test("it ignores if version is not supported", async (t) => {
  const hooks = new Hooks();
  hooks
    .addPackage("shell-quote")
    .withVersion("^2.0.0")
    .addSubject((exports) => exports)
    .inspect("method", () => {});

  const { agent } = createAgent();
  t.same(applyHooks(hooks, agent), {
    "shell-quote": {
      version: "1.8.1",
      supported: false,
    },
  });
});

function removeStackTraceErrorMessage(error: string) {
  const [msg] = error.split("\n");

  return msg;
}

t.test("it adds try/catch around the wrapped method", async (t) => {
  const hooks = new Hooks();
  const connection = hooks
    .addPackage("mysql2")
    .withVersion("^3.0.0")
    .addSubject((exports) => exports.Connection.prototype);
  connection.inspect("query", () => {
    throw new Error("THIS SHOULD BE CATCHED");
  });
  connection.modifyArguments("execute", () => {
    throw new Error("THIS SHOULD BE CATCHED");
  });
  connection.inspectResult("execute", () => {
    throw new Error("THIS SHOULD BE CATCHED");
  });

  const { agent, logger } = createAgent();
  t.same(applyHooks(hooks, agent), {
    mysql2: {
      version: "3.11.0",
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

  const [queryRows] = await runWithContext(context, () =>
    actualConnection.query("SELECT 1 as number")
  );
  t.same(queryRows, [{ number: 1 }]);

  const [executeRows] = await runWithContext(context, () =>
    actualConnection.execute("SELECT 1 as number")
  );
  t.same(executeRows, [{ number: 1 }]);

  t.same(logger.getMessages().map(removeStackTraceErrorMessage), [
    'Internal error in module "mysql2" in method "query"',
    'Internal error in module "mysql2" in method "execute"',
    'Internal error in module "mysql2" in method "execute"',
  ]);

  await actualConnection.end();
});

t.test("it hooks into dns module", async (t) => {
  const seenDomains: string[] = [];

  const hooks = new Hooks();
  hooks
    .addBuiltinModule("dns")
    .addSubject((exports) => exports.promises)
    .inspect("lookup", (args) => {
      if (typeof args[0] === "string") {
        seenDomains.push(args[0]);
      }
    });

  const { agent } = createAgent();
  t.same(applyHooks(hooks, agent), {});

  const { lookup } = require("dns/promises");

  await runWithContext(context, async () => await lookup("google.com"));

  t.same(seenDomains, ["google.com"]);
});

t.test(
  "it hooks into globals",
  { skip: !global.fetch ? "fetch is not available" : false },
  async () => {
    const hooks = new Hooks();

    let modifyCalled = false;
    hooks.addGlobal("fetch").inspect((args) => {
      modifyCalled = true;
    });

    let inspectCalled = false;
    hooks.addGlobal("atob").modifyArguments((args) => {
      inspectCalled = true;

      return args;
    });

    // Unknown global
    hooks.addGlobal("unknown").inspect(() => {});

    // Without interceptor
    hooks.addGlobal("setTimeout");

    const { agent, logger } = createAgent();
    t.same(applyHooks(hooks, agent), {});

    await runWithContext(context, async () => {
      await fetch("https://app.aikido.dev");
      t.same(modifyCalled, true);

      atob("aGVsbG8gd29ybGQ=");
      t.same(inspectCalled, true);
    });
  }
);

t.test("it ignores route if force protection off is on", async (t) => {
  const inspectionCalls: { args: unknown[] }[] = [];

  const hooks = new Hooks();
  hooks
    .addBuiltinModule("dns/promises")
    .addSubject((exports) => exports)
    .inspect("lookup", (args) => {
      inspectionCalls.push({ args });
    });

  const { agent, api } = createAgent();
  applyHooks(hooks, agent);

  api.setResult({
    success: true,
    endpoints: [
      {
        method: "GET",
        route: "/route",
        forceProtectionOff: true,
        // @ts-expect-error Test
        rateLimiting: undefined,
      },
    ],
    heartbeatIntervalInMS: 10 * 60 * 1000,
    blockedUserIds: [],
    allowedIPAddresses: [],
    configUpdatedAt: 0,
  });

  // Read rules from API
  await agent.flushStats(1000);

  const { lookup } = require("dns/promises");

  await lookup("www.google.com");
  t.same(inspectionCalls, [{ args: ["www.google.com"] }]);

  await runWithContext(context, async () => {
    await lookup("www.aikido.dev");
  });

  t.same(inspectionCalls, [
    { args: ["www.google.com"] },
    { args: ["www.aikido.dev"] },
  ]);

  await runWithContext(
    {
      ...context,
      method: "GET",
      route: "/route",
    },
    async () => {
      await lookup("www.times.com");
    }
  );

  t.same(inspectionCalls, [
    { args: ["www.google.com"] },
    { args: ["www.aikido.dev"] },
  ]);
});

t.test("it does not report attack if IP is allowed", async (t) => {
  const hooks = new Hooks();
  hooks
    .addBuiltinModule("os")
    .addSubject((exports) => exports)
    .inspect("hostname", (args, subject, agent) => {
      return {
        operation: "os.hostname",
        source: "body",
        pathToPayload: "path",
        payload: "payload",
        metadata: {},
        kind: "path_traversal",
      };
    });

  const { agent, api } = createAgent();
  applyHooks(hooks, agent);

  api.setResult({
    success: true,
    endpoints: [],
    configUpdatedAt: 0,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    blockedUserIds: [],
    allowedIPAddresses: ["::1"],
  });

  // Read rules from API
  await agent.flushStats(1000);
  api.clear();

  const { hostname } = require("os");

  await runWithContext(context, async () => {
    const name = hostname();
    t.ok(typeof name === "string");
  });

  t.same(api.getEvents(), []);
});

t.test("it can get the result of a method", async (t) => {
  let receivedResult: unknown | undefined;
  let receivedArgs: unknown[] | undefined;

  const hooks = new Hooks();
  hooks
    .addBuiltinModule("path")
    .addSubject((exports) => exports)
    .inspectResult("extname", (args, result) => {
      receivedArgs = args;
      receivedResult = result;
    });

  const { agent } = createAgent();
  t.same(applyHooks(hooks, agent), {});

  const { extname } = require("path");

  await runWithContext(context, async () => extname("file.txt"));

  t.same(receivedArgs, ["file.txt"]);
  t.same(receivedResult, ".txt");
});
