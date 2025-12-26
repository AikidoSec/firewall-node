import * as FakeTimers from "@sinonjs/fake-timers";
import { hostname, platform, release } from "os";
import * as t from "tap";
import { getSemverNodeVersion } from "../helpers/getNodeVersion";
import { ip } from "../helpers/ipAddress";
import { wrap } from "../helpers/wrap";
import { MongoDB } from "../sinks/MongoDB";
import { Agent } from "./Agent";
import { ReportingAPIForTesting } from "./api/ReportingAPIForTesting";
import { ReportingAPIThatThrows } from "./api/ReportingAPIThatThrows";
import { Event, DetectedAttack } from "./api/Event";
import { Token } from "./api/Token";
import { Hooks } from "./hooks/Hooks";
import { LoggerForTesting } from "./logger/LoggerForTesting";
import { LoggerNoop } from "./logger/LoggerNoop";
import { Wrapper } from "./Wrapper";
import { Context } from "./Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { setTimeout } from "node:timers/promises";
import { FetchListsAPIForTesting } from "./api/FetchListsAPIForTesting";

const mockedFetchListAPI = new FetchListsAPIForTesting({
  blockedIPAddresses: [
    {
      key: "some/key",
      source: "name",
      description: "Description",
      ips: ["1.3.2.0/24", "fe80::1234:5678:abcd:ef12/64"],
    },
  ],
  blockedUserAgents: "AI2Bot|Bytespider",
  allowedIPAddresses: [],
  monitoredIPAddresses: [],
  monitoredUserAgents: "",
  userAgentDetails: [
    {
      key: "AI2Bot",
      pattern: "AI2Bot",
    },
    {
      key: "Bytespider",
      pattern: "Bytespider",
    },
  ],
});

let logs: string[] = [];
wrap(console, "log", function log() {
  return function log(...args: string[]) {
    logs.push(...args);
  };
});

t.test("it throws error if serverless is empty string", async () => {
  t.throws(
    () =>
      new Agent(
        true,
        new LoggerNoop(),
        new ReportingAPIForTesting(),
        undefined,
        "",
        false,
        new FetchListsAPIForTesting()
      ),
    "Serverless cannot be an empty string"
  );
});

t.test("it sends started event", async (t) => {
  const logger = new LoggerForTesting();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([new MongoDB()]);

  // Require mongodb to see if agent logs message
  require("mongodb");

  t.match(api.getEvents(), [
    {
      type: "started",
      agent: {
        dryMode: false,
        hostname: hostname(),
        version: "0.0.0",
        ipAddress: ip(),
        packages: {},
        preventedPrototypePollution: false,
        nodeEnv: "",
        serverless: false,
        stack: [],
        os: {
          name: platform(),
          version: release(),
        },
        platform: {
          version: getSemverNodeVersion(),
          arch: process.arch,
        },
      },
    },
  ]);

  t.same(logger.getMessages(), [
    "Starting agent v0.0.0...",
    "Found token, reporting enabled!",
    "mongodb@6.20.0 is supported!",
  ]);
});

t.test("it throws error if already started", async () => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([new MongoDB()]);
  t.throws(() => agent.start([new MongoDB()]), "Agent already started!");
});

class WrapperForTesting implements Wrapper {
  wrap(hooks: Hooks) {
    hooks.addPackage("shell-quote").withVersion("^3.0.0");
  }
}

t.test("it logs if package is supported or not", async () => {
  const logger = new LoggerForTesting();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([new WrapperForTesting()]);

  agent.onPackageWrapped("shell-quote", { version: "1.8.1", supported: false });

  t.same(logger.getMessages(), [
    "Starting agent v0.0.0...",
    "Found token, reporting enabled!",
    "shell-quote@1.8.1 is not supported!",
  ]);
});

t.test("it starts in non-blocking mode", async () => {
  const logger = new LoggerForTesting();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    block: false,
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([]);

  t.same(logger.getMessages(), [
    "Starting agent v0.0.0...",
    "Dry mode enabled, no requests will be blocked!",
    "Found token, reporting enabled!",
  ]);
});

t.test("when prevent prototype pollution is enabled", async (t) => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.onPrototypePollutionPrevented();
  agent.start([]);
  t.match(api.getEvents(), [
    {
      agent: {
        preventedPrototypePollution: true,
      },
    },
  ]);
});

t.test("it does not start interval in serverless mode", async () => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
    serverless: "lambda",
  });
  // This would otherwise keep the process running
  agent.start([]);
});

t.test("when attack detected in blocking mode", async () => {
  logs = []; // Clear console logs

  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
    block: true,
  });

  agent.onDetectedAttack({
    module: "mongodb",
    kind: "nosql_injection",
    blocked: true,
    source: "body",
    request: {
      method: "POST",
      cookies: {},
      query: {},
      headers: {
        "user-agent": "agent",
      },
      body: {},
      url: "http://localhost:4000",
      remoteAddress: "::1",
      source: "express",
      route: "/posts/:id",
      routeParams: {},
    },
    operation: "operation",
    payload: "payload",
    stack: "stack",
    paths: [".nested"],
    metadata: {
      db: "app",
    },
  });

  t.same(logs, [
    'Zen has blocked a NoSQL injection: kind="nosql_injection" operation="operation(...)" source="body.nested" ip="::1"',
  ]);

  t.match(api.getEvents(), [
    {
      type: "detected_attack",
      attack: {
        module: "mongodb",
        kind: "nosql_injection",
        blocked: true,
        source: "body",
        path: ".nested",
        stack: "stack",
        metadata: {
          db: "app",
        },
      },
      request: {
        method: "POST",
        ipAddress: "::1",
        userAgent: "agent",
        url: "http://localhost:4000",
        route: "/posts/:id",
      },
    },
  ]);
});

t.test("when attack detected in detection only mode", async () => {
  logs = []; // Clear console logs

  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
    block: false,
  });

  agent.onDetectedAttack({
    module: "mongodb",
    kind: "nosql_injection",
    blocked: true,
    source: "body",
    request: {
      method: "POST",
      cookies: {},
      query: {},
      headers: {
        "user-agent": "agent",
      },
      body: {},
      url: "http://localhost:4000",
      remoteAddress: "::1",
      source: "express",
      route: "/posts/:id",
      routeParams: {},
    },
    operation: "operation",
    payload: "payload",
    stack: "stack",
    paths: [".nested"],
    metadata: {
      db: "app",
    },
  });

  t.same(logs, [
    'Zen has blocked a NoSQL injection: kind="nosql_injection" operation="operation(...)" source="body.nested" ip="::1"',
  ]);

  t.match(api.getEvents(), [
    {
      type: "detected_attack",
      attack: {
        module: "mongodb",
        kind: "nosql_injection",
        blocked: true,
        source: "body",
        path: ".nested",
        stack: "stack",
        metadata: {
          db: "app",
        },
      },
      request: {
        method: "POST",
        ipAddress: "::1",
        userAgent: "agent",
        url: "http://localhost:4000",
        route: "/posts/:id",
      },
    },
  ]);
});

t.test("it checks if user agent is a string", async () => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.onDetectedAttack({
    module: "mongodb",
    kind: "nosql_injection",
    blocked: true,
    source: "body",
    request: {
      method: "POST",
      cookies: {},
      query: {},
      headers: {
        "user-agent": undefined,
      },
      body: {},
      url: "http://localhost:4000",
      remoteAddress: "::1",
      source: "express",
      route: "/posts/:id",
      routeParams: {},
    },
    payload: "payload",
    operation: "operation",
    stack: "stack",
    paths: [".nested"],
    metadata: {
      db: "app",
    },
  });

  t.match(api.getEvents(), [
    {
      type: "detected_attack",
      attack: {
        module: "mongodb",
        kind: "nosql_injection",
        blocked: true,
        source: "body",
        path: ".nested",
        stack: "stack",
        metadata: {
          db: "app",
        },
      },
      request: {
        method: "POST",
        ipAddress: "::1",
        url: "http://localhost:4000",
      },
    },
  ]);
});

t.test(
  "it sends heartbeat when config says we didn't receive any stats",
  async () => {
    const clock = FakeTimers.install();

    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting({
      success: true,
      endpoints: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
      allowedIPAddresses: [],
      block: true,
      blockNewOutgoingRequests: false,
    });
    const agent = createTestAgent({
      api,
      logger,
      token: new Token("123"),
      suppressConsoleLog: false,
    });
    agent.start([]);
    t.match(api.getEvents(), [
      {
        type: "started",
      },
    ]);

    // Increment total requests
    agent.getInspectionStatistics().onRequest();

    // After 5 seconds, nothing should happen
    clock.tick(1000 * 5);
    t.match(api.getEvents(), [
      {
        type: "started",
      },
    ]);

    // After a minute, we'll see that the dashboard didn't receive any stats yet
    // And then send a heartbeat
    clock.tick(60 * 1000);
    await clock.nextAsync();
    t.match(api.getEvents(), [
      {
        type: "started",
      },
      {
        type: "heartbeat",
      },
    ]);

    // We already reported initial stats, so we won't send another heartbeat
    clock.tick(60 * 1000);
    await clock.nextAsync();
    t.match(api.getEvents(), [
      {
        type: "started",
      },
      {
        type: "heartbeat",
      },
    ]);

    clock.uninstall();
  }
);

t.test(
  "it does not heartbeat when config says we didn't receive any stats and stats is empty",
  async () => {
    const clock = FakeTimers.install();

    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting({
      success: true,
      endpoints: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
      allowedIPAddresses: [],
      block: true,
    });
    const agent = createTestAgent({
      api,
      logger,
      token: new Token("123"),
      suppressConsoleLog: false,
    });
    agent.start([]);
    t.match(api.getEvents(), [
      {
        type: "started",
      },
    ]);

    // After 5 seconds, nothing should happen
    clock.tick(1000 * 5);
    t.match(api.getEvents(), [
      {
        type: "started",
      },
    ]);

    // After a minute, we'll see that the dashboard didn't receive any stats yet
    // But the stats is still empty, so we won't send a heartbeat
    clock.tick(60 * 1000);
    await clock.nextAsync();
    t.match(api.getEvents(), [
      {
        type: "started",
      },
    ]);

    clock.uninstall();
  }
);

t.test("it sends heartbeat when reached max timings", async () => {
  const clock = FakeTimers.install();

  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([]);
  for (let i = 0; i < 1000; i++) {
    agent.getInspectionStatistics().onInspectedCall({
      operation: "MongoDB.query",
      kind: "nosql_op",
      blocked: false,
      durationInMs: 0.1,
      attackDetected: false,
      withoutContext: false,
    });
  }
  t.match(api.getEvents(), [
    {
      type: "started",
    },
  ]);
  for (let i = 0; i < 4001; i++) {
    agent.getInspectionStatistics().onInspectedCall({
      operation: "MongoDB.query",
      kind: "nosql_op",
      blocked: false,
      durationInMs: 0.1,
      attackDetected: false,
      withoutContext: false,
    });
  }

  // After 5 seconds, nothing should happen
  clock.tick(1000 * 5);

  t.match(api.getEvents(), [
    {
      type: "started",
    },
  ]);

  // After 30 seconds, the first heartbeat should be sent
  clock.tick(30 * 1000);
  await clock.nextAsync();

  t.match(api.getEvents(), [
    {
      type: "started",
    },
    {
      type: "heartbeat",
    },
  ]);

  // After another 2 minutes, another heartbeat should be sent
  clock.tick(2 * 60 * 1000);
  await clock.nextAsync();

  t.match(api.getEvents(), [
    {
      type: "started",
    },
    {
      type: "heartbeat",
    },
    {
      type: "heartbeat",
    },
  ]);

  // Every 10 minutes, another heartbeat should be sent
  clock.tick(11 * 60 * 1000);
  await clock.nextAsync();

  t.match(api.getEvents(), [
    {
      type: "started",
    },
    {
      type: "heartbeat",
    },
    {
      type: "heartbeat",
    },
    {
      type: "heartbeat",
    },
  ]);

  // Every 10 minutes, another heartbeat should be sent
  clock.tick(11 * 60 * 1000);
  await clock.nextAsync();

  t.match(api.getEvents(), [
    {
      type: "started",
    },
    {
      type: "heartbeat",
    },
    {
      type: "heartbeat",
    },
    {
      type: "heartbeat",
    },
    {
      type: "heartbeat",
    },
  ]);

  clock.uninstall();
});

t.test("it logs when failed to report event", async () => {
  const logger = new LoggerForTesting();
  const api = new ReportingAPIThatThrows();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([]);

  await setTimeout(0);

  // @ts-expect-error Private method
  agent.heartbeat();

  await setTimeout(0);

  agent.onDetectedAttack({
    module: "mongodb",
    kind: "nosql_injection",
    blocked: true,
    source: "body",
    request: {
      method: "POST",
      cookies: {},
      query: {},
      headers: {
        "user-agent": "agent",
      },
      body: {},
      url: "http://localhost:4000",
      remoteAddress: "::1",
      source: "express",
      route: "/posts/:id",
      routeParams: {},
    },
    operation: "operation",
    stack: "stack",
    paths: [".nested"],
    payload: "payload",
    metadata: {
      db: "app",
    },
  });

  await setTimeout(0);

  t.same(logger.getMessages(), [
    "Starting agent v0.0.0...",
    "Found token, reporting enabled!",
    "Heartbeat...",
    "Failed to do heartbeat",
    "Failed to report attack",
  ]);
});

t.test("unable to prevent prototype pollution", async () => {
  const clock = FakeTimers.install();

  const logger = new LoggerForTesting();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([]);
  agent.unableToPreventPrototypePollution({ mongoose: "1.0.0" });
  t.same(logger.getMessages(), [
    "Starting agent v0.0.0...",
    "Found token, reporting enabled!",
    "Unable to prevent prototype pollution, incompatible packages found: mongoose@1.0.0",
  ]);

  clock.tick(1000 * 60 * 30);
  await clock.nextAsync();

  t.same(api.getEvents().length, 2);
  const [_, heartbeat] = api.getEvents();
  t.same(heartbeat.type, "heartbeat");
  t.same(heartbeat.agent.incompatiblePackages, {
    prototypePollution: {
      mongoose: "1.0.0",
    },
  });

  clock.uninstall();
});

t.test("when payload is object", async () => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.onDetectedAttack({
    module: "mongodb",
    kind: "nosql_injection",
    blocked: true,
    source: "body",
    request: {
      method: "POST",
      cookies: {},
      query: {},
      headers: {
        "user-agent": "agent",
      },
      body: "payload",
      url: "http://localhost:4000",
      remoteAddress: "::1",
      source: "express",
      route: "/posts/:id",
      routeParams: {},
    },
    operation: "operation",
    payload: { $gt: "" },
    stack: "stack",
    paths: [".nested"],
    metadata: {
      db: "app",
    },
  });

  agent.onDetectedAttack({
    module: "mongodb",
    kind: "nosql_injection",
    blocked: true,
    source: "body",
    request: {
      method: "POST",
      cookies: {},
      query: {},
      headers: {
        "user-agent": "agent",
      },
      body: "payload",
      url: "http://localhost:4000",
      remoteAddress: "::1",
      source: "express",
      route: "/posts/:id",
      routeParams: {},
    },
    operation: "operation",
    payload: "a".repeat(20000),
    stack: "stack",
    paths: [".nested"],
    metadata: {
      db: "app",
    },
  });

  function isDetectedAttack(event: Event): event is DetectedAttack {
    return event.type === "detected_attack";
  }

  t.same(
    api
      .getEvents()
      .filter(isDetectedAttack)
      .map((event) => event.attack.payload),
    [
      JSON.stringify({ $gt: "" }),
      JSON.stringify("a".repeat(20000)).substring(0, 4096),
    ]
  );
});

function getRouteContext(
  method: string,
  route: string,
  headers: Record<string, string> = {},
  body: any = undefined
): Context {
  return {
    method,
    route,
    headers,
    body,
    remoteAddress: "",
    url: `http://localhost${route}`,
    routeParams: {},
    query: {},
    cookies: {},
    source: "test",
  };
}

t.test("it sends hostnames and routes along with heartbeat", async () => {
  const clock = FakeTimers.install();

  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([]);

  agent.onConnectHostname("aikido.dev", 443);
  agent.onConnectHostname("aikido.dev", 80);
  agent.onConnectHostname("google.com", 443);
  agent.onRouteExecute(getRouteContext("POST", "/posts/:id"));
  agent.onRouteExecute(getRouteContext("POST", "/posts/:id"));
  agent.onRouteExecute(getRouteContext("GET", "/posts/:id"));
  agent.onRouteExecute(getRouteContext("GET", "/"));
  agent.onRouteExecute(
    getRouteContext(
      "POST",
      "/publish",
      { "content-type": "application/json" },
      { a: 1, b: ["c", "d"] }
    )
  );

  api.clear();

  await agent.flushStats(1000);

  t.match(api.getEvents(), [
    {
      type: "heartbeat",
      middlewareInstalled: false,
      hostnames: [
        {
          hostname: "aikido.dev",
          port: 443,
          hits: 1,
        },
        {
          hostname: "aikido.dev",
          port: 80,
          hits: 1,
        },
        {
          hostname: "google.com",
          port: 443,
          hits: 1,
        },
      ],
      routes: [
        {
          method: "POST",
          path: "/posts/:id",
          hits: 2,
          graphql: undefined,
          apispec: {},
        },
        {
          method: "GET",
          path: "/posts/:id",
          hits: 1,
          graphql: undefined,
          apispec: {},
        },
        {
          method: "GET",
          path: "/",
          hits: 1,
          graphql: undefined,
          apispec: {},
        },
        {
          method: "POST",
          path: "/publish",
          hits: 1,
          graphql: undefined,
          apispec: {
            body: {
              type: "json",
              schema: {
                type: "object",
                properties: {
                  a: { type: "number" },
                  b: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                },
              },
            },
            query: undefined,
            auth: undefined,
          },
        },
      ],
    },
  ]);

  clock.uninstall();
});

t.test(
  "it stays on blocking mode if server did not return block mode",
  async () => {
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const agent = createTestAgent({
      api,
      logger,
      token: new Token("123"),
      suppressConsoleLog: false,
    });
    t.same(agent.shouldBlock(), true);
    agent.start([]);

    // Wait for the event to be sent
    await setTimeout(0);

    t.same(agent.shouldBlock(), true);
  }
);

t.test(
  "it stays on monitoring mode if server did not return block mode",
  async () => {
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const agent = createTestAgent({
      block: false,
      api,
      logger,
      token: new Token("123"),
      suppressConsoleLog: false,
    });
    t.same(agent.shouldBlock(), false);
    agent.start([]);

    // Wait for the event to be sent
    await setTimeout(0);

    t.same(agent.shouldBlock(), false);
  }
);

t.test("it enables blocking mode after sending startup event", async () => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting({
    success: true,
    endpoints: [],
    configUpdatedAt: 0,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    blockedUserIds: [],
    allowedIPAddresses: [],
    block: true,
  });
  const agent = createTestAgent({
    token: new Token("123"),
    suppressConsoleLog: false,
    block: false,
    api,
    logger,
  });
  t.same(agent.shouldBlock(), false);
  agent.start([]);

  // Wait for the event to be sent
  await setTimeout(0);

  t.same(agent.shouldBlock(), true);
});

t.test("it goes into monitoring mode after sending startup event", async () => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting({
    success: true,
    endpoints: [],
    configUpdatedAt: 0,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    blockedUserIds: [],
    allowedIPAddresses: [],
    block: false,
  });
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  t.same(agent.shouldBlock(), true);
  agent.start([]);

  // Wait for the event to be sent
  await setTimeout(0);

  t.same(agent.shouldBlock(), false);
});

t.test("it sends middleware installed with heartbeat", async () => {
  const clock = FakeTimers.install();

  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([]);

  agent.onMiddlewareExecuted();

  api.clear();

  await agent.flushStats(1000);

  t.match(api.getEvents(), [
    {
      type: "heartbeat",
      hostnames: [],
      routes: [],
      middlewareInstalled: true,
    },
  ]);

  clock.uninstall();
});

t.test("it fetches blocked lists", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    suppressConsoleLog: false,
    fetchListsAPI: mockedFetchListAPI,
  });

  agent.start([]);

  await setTimeout(0);

  t.same(agent.getConfig().isIPAddressBlocked("1.3.2.4"), {
    blocked: true,
    reason: "Description",
  });
  t.same(agent.getConfig().isIPAddressBlocked("fe80::1234:5678:abcd:ef12"), {
    blocked: true,
    reason: "Description",
  });

  t.same(
    agent
      .getConfig()
      .isUserAgentBlocked(
        "Mozilla/5.0 (compatible) AI2Bot (+https://www.allenai.org/crawler)"
      ),
    {
      blocked: true,
    }
  );

  t.same(
    agent.getConfig().isUserAgentBlocked("Mozilla/5.0 (compatible) Bytespider"),
    {
      blocked: true,
    }
  );

  t.same(agent.getConfig().isUserAgentBlocked("Mozilla/5.0 (compatible)"), {
    blocked: false,
  });
});

t.test("it does not fetch blocked IPs if serverless", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    suppressConsoleLog: false,
    serverless: "gcp",
  });

  agent.start([]);

  await setTimeout(0);

  t.same(agent.getConfig().isIPAddressBlocked("1.3.2.4"), {
    blocked: false,
  });

  t.same(agent.getConfig().isAllowedIPAddress("1.3.2.4"), {
    allowed: true,
  });

  t.same(
    agent
      .getConfig()
      .isUserAgentBlocked(
        "Mozilla/5.0 (compatible) AI2Bot (+https://www.allenai.org/crawler)"
      ),
    {
      blocked: false,
    }
  );
});

t.test("it only allows some IP addresses", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    suppressConsoleLog: false,
    fetchListsAPI: new FetchListsAPIForTesting({
      blockedIPAddresses: [
        {
          key: "some/key",
          source: "name",
          description: "Description",
          ips: ["1.3.2.0/24", "fe80::1234:5678:abcd:ef12/64"],
        },
      ],
      blockedUserAgents: "AI2Bot|Bytespider",
      allowedIPAddresses: [
        {
          key: "some/key",
          source: "name",
          description: "Description",
          ips: ["4.3.2.1"],
        },
      ],
      monitoredIPAddresses: [],
      monitoredUserAgents: "",
      userAgentDetails: [
        {
          key: "AI2Bot",
          pattern: "AI2Bot",
        },
        {
          key: "Bytespider",
          pattern: "Bytespider",
        },
      ],
    }),
  });

  agent.start([]);

  await setTimeout(0);

  t.same(agent.getConfig().isIPAddressBlocked("1.3.2.4"), {
    blocked: true,
    reason: "Description",
  });
  t.same(agent.getConfig().isIPAddressBlocked("fe80::1234:5678:abcd:ef12"), {
    blocked: true,
    reason: "Description",
  });

  t.same(agent.getConfig().isAllowedIPAddress("1.2.3.4"), {
    allowed: false,
  });
  t.same(agent.getConfig().isAllowedIPAddress("4.3.2.1"), {
    allowed: true,
  });
});

t.test("it includes agent's own package in heartbeat", async () => {
  const clock = FakeTimers.install();

  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([]);

  api.clear();

  await agent.flushStats(1000);

  t.match(api.getEvents(), [
    {
      type: "heartbeat",
      packages: [
        {
          name: "@aikidosec/firewall",
          version: "0.0.0",
          requiredAt: 0,
        },
      ],
    },
  ]);

  clock.uninstall();
});

t.test("attack wave detected event", async (t) => {
  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
    block: true,
  });

  agent.onDetectedAttackWave({
    request: {
      method: "POST",
      cookies: {},
      query: {},
      headers: {
        "user-agent": "agent",
      },
      body: {},
      url: "http://localhost:4000",
      remoteAddress: "::1",
      source: "express",
      route: "/posts/:id",
      routeParams: {},
    },
  });

  t.match(api.getEvents(), [
    {
      type: "detected_attack_wave",
      attack: {
        metadata: {
          samples: "[]",
        },
      },
      request: {
        ipAddress: "::1",
        userAgent: "agent",
        source: "express",
      },
    },
  ]);
});

t.test("it blocks new outgoing requests if config says so", async () => {
  const clock = FakeTimers.install();

  const logger = new LoggerNoop();
  const api = new ReportingAPIForTesting({
    success: true,
    endpoints: [],
    configUpdatedAt: 0,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    blockedUserIds: [],
    allowedIPAddresses: [],
    block: true,
    receivedAnyStats: false,
    blockNewOutgoingRequests: true,
    domains: [
      { hostname: "example.com", mode: "block" },
      { hostname: "aikido.dev", mode: "allow" },
    ],
  });
  const agent = createTestAgent({
    api,
    logger,
    token: new Token("123"),
    suppressConsoleLog: false,
  });
  agent.start([]);

  await agent.flushStats(1000);

  t.same(agent.getConfig().shouldBlockOutgoingRequest("foo.bar"), true);
  t.same(agent.getConfig().shouldBlockOutgoingRequest("example.com"), true);
  t.same(agent.getConfig().shouldBlockOutgoingRequest("aikido.dev"), false);

  clock.uninstall();
});

t.test(
  "it does not block new outgoing requests if config says so",
  async () => {
    const clock = FakeTimers.install();

    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting({
      success: true,
      endpoints: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
      allowedIPAddresses: [],
      block: true,
      receivedAnyStats: false,
      blockNewOutgoingRequests: false,
      domains: [
        { hostname: "example.com", mode: "block" },
        { hostname: "aikido.dev", mode: "allow" },
      ],
    });
    const agent = createTestAgent({
      api,
      logger,
      token: new Token("123"),
      suppressConsoleLog: false,
    });
    agent.start([]);

    await agent.flushStats(1000);

    t.same(agent.getConfig().shouldBlockOutgoingRequest("foo.bar"), false);
    t.same(agent.getConfig().shouldBlockOutgoingRequest("example.com"), true);
    t.same(agent.getConfig().shouldBlockOutgoingRequest("aikido.dev"), false);

    clock.uninstall();
  }
);
