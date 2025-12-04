import * as t from "tap";
import { ReportingAPIForTesting } from "./api/ReportingAPIForTesting";
import { Token } from "./api/Token";
import { applyHooks } from "./applyHooks";
import { Context, runWithContext } from "./Context";
import { Hooks } from "./hooks/Hooks";
import { wrapExport } from "./hooks/wrapExport";
import { createTestAgent } from "../helpers/createTestAgent";

const getContext = (): Context => {
  return {
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
};

const reportingAPI = new ReportingAPIForTesting();

const agent = createTestAgent({
  serverless: "lambda",
  api: reportingAPI,
  token: new Token("123"),
});

t.test(
  "it hooks into globals",
  { skip: !global.fetch ? "fetch is not available" : false },
  async () => {
    const hooks = new Hooks();

    let modifyCalled = false;
    hooks.addGlobal("fetch", {
      kind: "outgoing_http_op",
      modifyArgs: (args) => {
        modifyCalled = true;
        return args;
      },
    });

    let inspectCalled = false;
    hooks.addGlobal("atob", {
      kind: "outgoing_http_op",
      inspectArgs: (args) => {
        inspectCalled = true;
      },
    });

    // Unknown global
    hooks.addGlobal("unknown", {
      kind: "outgoing_http_op",
      inspectArgs: (args) => {
        return;
      },
    });

    // Without name
    // @ts-expect-error Test with invalid arguments
    const error = t.throws(() => hooks.addGlobal());
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.ok(/Name is required/.test(error.message));
    }

    // Without interceptor
    // @ts-expect-error Test with invalid arguments
    const error2 = t.throws(() => hooks.addGlobal("setTimeout"));
    t.ok(error2 instanceof Error);
    if (error2 instanceof Error) {
      t.ok(/Interceptors are required/.test(error2.message));
    }

    applyHooks(hooks, agent.isUsingNewInstrumentation());

    await runWithContext(getContext(), async () => {
      await fetch("https://app.aikido.dev");
      t.same(modifyCalled, true);

      t.same(inspectCalled, false);
      atob("aGVsbG8gd29ybGQ=");
      t.same(inspectCalled, true);
    });
  }
);

t.test("it ignores route if force protection off is on", async (t) => {
  const inspectionCalls: { args: unknown[] }[] = [];

  const hooks = new Hooks();
  hooks.addBuiltinModule("dns/promises").onRequire((exports, pkgInfo) => {
    wrapExport(exports, "lookup", pkgInfo, {
      kind: "outgoing_http_op",
      inspectArgs: (args, agent) => {
        inspectionCalls.push({ args });
      },
    });
  });

  applyHooks(hooks, agent.isUsingNewInstrumentation());

  reportingAPI.setResult({
    success: true,
    endpoints: [
      {
        method: "GET",
        route: "/route",
        forceProtectionOff: true,
        rateLimiting: {
          enabled: false,
          maxRequests: 0,
          windowSizeInMS: 0,
        },
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

  await runWithContext(getContext(), async () => {
    await lookup("www.aikido.dev");
  });

  t.same(inspectionCalls, [
    { args: ["www.google.com"] },
    { args: ["www.aikido.dev"] },
  ]);

  await runWithContext(
    {
      ...getContext(),
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
  hooks.addBuiltinModule("os").onRequire((exports, pkgInfo) => {
    wrapExport(exports, "hostname", pkgInfo, {
      kind: "fs_op",
      inspectArgs: (args, agent) => {
        return {
          operation: "os.hostname",
          source: "body",
          pathsToPayload: ["path"],
          payload: "payload",
          metadata: {},
          kind: "path_traversal",
        };
      },
    });
  });

  applyHooks(hooks, agent.isUsingNewInstrumentation());

  reportingAPI.setResult({
    success: true,
    endpoints: [],
    configUpdatedAt: 0,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    blockedUserIds: [],
    allowedIPAddresses: ["::1"],
  });

  // Read rules from API
  await agent.flushStats(1000);
  reportingAPI.clear();

  const { hostname } = require("os");

  await runWithContext(getContext(), async () => {
    const name = hostname();
    t.ok(typeof name === "string");
  });

  t.same(reportingAPI.getEvents(), []);
});
