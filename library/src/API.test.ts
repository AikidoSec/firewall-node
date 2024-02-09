import * as t from "tap";
import { APIForTesting, APIThrottled, Token, Event } from "./API";

function generateAttackEvent(): Event {
  return {
    type: "detected_attack",
    time: Date.now(),
    request: {
      url: undefined,
      method: undefined,
      ipAddress: undefined,
      userAgent: undefined,
    },
    attack: {
      module: "module",
      blocked: false,
      source: "body",
      path: "path",
      stack: "stack",
      kind: "nosql_injection",
      metadata: {},
    },
    agent: {
      id: "id",
      version: "1.0.0",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      os: {
        name: "os",
        version: "version",
      },
    },
  };
}

t.test("it throttles attack events", async () => {
  const api = new APIForTesting();
  const token = new Token("123");

  const throttled = new APIThrottled(api, {
    maxEventsPerInterval: 5,
    intervalInMs: 1000,
  });

  t.match(api.getEvents().length, 0);
  await throttled.report(token, generateAttackEvent());
  t.match(api.getEvents().length, 1);
  await throttled.report(token, generateAttackEvent());
  t.match(api.getEvents().length, 2);
  await throttled.report(token, generateAttackEvent());
  t.match(api.getEvents().length, 3);
  await throttled.report(token, generateAttackEvent());
  t.match(api.getEvents().length, 4);
  await throttled.report(token, generateAttackEvent());
  t.match(api.getEvents().length, 5);
  await throttled.report(token, generateAttackEvent());
  t.match(api.getEvents().length, 5);

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await throttled.report(token, generateAttackEvent());
  t.match(api.getEvents().length, 6);
});

function generateStartedEvent(): Event {
  return {
    type: "started",
    time: Date.now(),
    agent: {
      id: "id",
      version: "1.0.0",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      os: {
        name: "os",
        version: "version",
      },
    },
  };
}

t.test("it always allows started events", async () => {
  const api = new APIForTesting();
  const token = new Token("123");

  const throttled = new APIThrottled(api, {
    maxEventsPerInterval: 5,
    intervalInMs: 1000,
  });

  t.match(api.getEvents().length, 0);
  await throttled.report(token, generateStartedEvent());
  t.match(api.getEvents().length, 1);
  await throttled.report(token, generateStartedEvent());
  t.match(api.getEvents().length, 2);
  await throttled.report(token, generateStartedEvent());
  t.match(api.getEvents().length, 3);
  await throttled.report(token, generateStartedEvent());
  t.match(api.getEvents().length, 4);
  await throttled.report(token, generateStartedEvent());
  t.match(api.getEvents().length, 5);
  await throttled.report(token, generateStartedEvent());
  t.match(api.getEvents().length, 6);
});

function generateHeartbeatEvent(): Event {
  return {
    type: "heartbeat",
    time: Date.now(),
    stats: {},
    agent: {
      id: "id",
      version: "1.0.0",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      os: {
        name: "os",
        version: "version",
      },
    },
  };
}

t.test("it always allows heartbeat events", async () => {
  const api = new APIForTesting();
  const token = new Token("123");

  const throttled = new APIThrottled(api, {
    maxEventsPerInterval: 5,
    intervalInMs: 1000,
  });

  t.match(api.getEvents().length, 0);
  await throttled.report(token, generateHeartbeatEvent());
  t.match(api.getEvents().length, 1);
  await throttled.report(token, generateHeartbeatEvent());
  t.match(api.getEvents().length, 2);
  await throttled.report(token, generateHeartbeatEvent());
  t.match(api.getEvents().length, 3);
  await throttled.report(token, generateHeartbeatEvent());
  t.match(api.getEvents().length, 4);
  await throttled.report(token, generateHeartbeatEvent());
  t.match(api.getEvents().length, 5);
  await throttled.report(token, generateHeartbeatEvent());
  t.match(api.getEvents().length, 6);
});
