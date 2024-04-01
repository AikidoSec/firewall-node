import * as FakeTimers from "@sinonjs/fake-timers";
import { hostname, platform, release } from "os";
import * as t from "tap";
import { ip } from "../helpers/ipAddress";
import { MongoDB } from "../sinks/MongoDB";
import { Agent } from "./Agent";
import { APIForTesting } from "./api/APIForTesting";
import { APIThatThrows } from "./api/APIThatThrows";
import { Event, DetectedAttack } from "./api/Event";
import { Token } from "./api/Token";
import { Hooks } from "./hooks/Hooks";
import { LoggerForTesting } from "./logger/LoggerForTesting";
import { LoggerNoop } from "./logger/LoggerNoop";
import { Wrapper } from "./Wrapper";

t.test("it sends started event", async (t) => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([new MongoDB()]);

  t.match(api.getEvents(), [
    {
      type: "started",
      agent: {
        dryMode: false,
        hostname: hostname(),
        version: "0.0.0",
        ipAddress: ip(),
        packages: {
          mongodb: "6.3.0",
        },
        preventedPrototypePollution: false,
        nodeEnv: "",
        serverless: false,
        os: {
          name: platform(),
          version: release(),
        },
      },
    },
  ]);
});

t.test("it throws error if already started", async () => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([new MongoDB()]);
  t.throws(() => agent.start([new MongoDB()]), "Agent already started!");
});

class WrapperForTesting implements Wrapper {
  wrap(hooks: Hooks) {
    hooks.addPackage("shimmer").withVersion("^3.0.0");
  }
}

t.test("it logs if package is supported or not", async () => {
  const logger = new LoggerForTesting();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([new WrapperForTesting()]);
  t.same(logger.getMessages(), [
    "Starting agent...",
    "Found token, reporting enabled!",
    "shimmer@1.2.1 is not supported!",
  ]);
});

t.test("it starts in non-blocking mode", async () => {
  const logger = new LoggerForTesting();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(false, logger, api, token, undefined);
  agent.start([new MongoDB()]);
  t.same(logger.getMessages(), [
    "Starting agent...",
    "Dry mode enabled, no requests will be blocked!",
    "Found token, reporting enabled!",
    "mongodb@6.3.0 is supported!",
  ]);
});

t.test("when prevent prototype pollution is enabled", async (t) => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, "lambda");
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
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, "lambda");

  // This would otherwise keep the process running
  agent.start([]);
});

t.test("when attack detected", async () => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
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
    },
    operation: "operation",
    payload: "payload",
    stack: "stack",
    path: ".nested",
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
        userAgent: "agent",
        url: "http://localhost:4000",
        headers: {},
        body: "{}",
      },
    },
  ]);
});

t.test("it checks if user agent is a string", async () => {
  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
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
    },
    payload: "payload",
    operation: "operation",
    stack: "stack",
    path: ".nested",
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
        headers: {},
        body: "{}",
      },
    },
  ]);
});

t.test("it sends heartbeat when reached max timings", async () => {
  const clock = FakeTimers.install();

  const logger = new LoggerNoop();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);
  for (let i = 0; i < 1000; i++) {
    agent.getInspectionStatistics().onInspectedCall({
      sink: "mongodb",
      blocked: false,
      durationInMs: 0.1,
      attackDetected: false,
    });
  }
  t.match(api.getEvents(), [
    {
      type: "started",
    },
  ]);
  for (let i = 0; i < 4001; i++) {
    agent.getInspectionStatistics().onInspectedCall({
      sink: "mongodb",
      blocked: false,
      durationInMs: 0.1,
      attackDetected: false,
    });
  }

  // After 5 seconds, nothing should happen
  clock.tick(1000 * 5);

  t.match(api.getEvents(), [
    {
      type: "started",
    },
  ]);

  // After 10 minutes, we'll see that the required amount of performance samples has been reached
  // And then send a heartbeat
  clock.tick(10 * 60 * 1000);

  t.match(api.getEvents(), [
    {
      type: "started",
    },
    {
      type: "heartbeat",
    },
  ]);

  // After another 10 minutes, we'll see that we already sent the initial stats
  clock.tick(10 * 60 * 1000);

  t.match(api.getEvents(), [
    {
      type: "started",
    },
    {
      type: "heartbeat",
    },
  ]);

  // Every 30 minutes we'll send a heartbeat
  clock.tick(30 * 60 * 1000);

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

  clock.uninstall();
});

t.test("it logs when failed to report event", async () => {
  const logger = new LoggerForTesting();
  const api = new APIThatThrows();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);

  // @ts-expect-error Private method
  agent.heartbeat();

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
    },
    operation: "operation",
    stack: "stack",
    path: ".nested",
    payload: "payload",
    metadata: {
      db: "app",
    },
  });

  // API calls are async, wait for them to finish
  await new Promise((resolve) => setTimeout(resolve, 0));

  t.same(logger.getMessages(), [
    "Starting agent...",
    "Found token, reporting enabled!",
    "Heartbeat...",
    "Failed to report started event",
    "Failed to do heartbeat",
    "Failed to report attack",
  ]);
});

t.test("unable to prevent prototype pollution", async () => {
  const clock = FakeTimers.install();

  const logger = new LoggerForTesting();
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);
  agent.start([]);
  agent.unableToPreventPrototypePollution({ mongoose: "1.0.0" });
  t.same(logger.getMessages(), [
    "Starting agent...",
    "Found token, reporting enabled!",
    "Unable to prevent prototype pollution, incompatible packages found: mongoose@1.0.0",
  ]);

  clock.tick(1000 * 60 * 30);
  clock.next();

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
  const api = new APIForTesting();
  const token = new Token("123");
  const agent = new Agent(true, logger, api, token, undefined);

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
    },
    operation: "operation",
    payload: { $gt: "" },
    stack: "stack",
    path: ".nested",
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
    },
    operation: "operation",
    payload: "a".repeat(20000),
    stack: "stack",
    path: ".nested",
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
