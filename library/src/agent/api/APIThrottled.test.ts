import * as t from "tap";

import { APIForTesting } from "./APIForTesting";
import { APIThrottled } from "./APIThrottled";
import { Token } from "./Token";
import { Event } from "./Event";

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
      version: "1.0.0",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      preventedPrototypePollution: false,
      nodeEnv: "",
      os: {
        name: "os",
        version: "version",
      },
      serverless: false,
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

  t.same(api.getEvents().length, 0);
  await throttled.report(token, generateAttackEvent());
  t.same(api.getEvents().length, 1);
  await throttled.report(token, generateAttackEvent());
  t.same(api.getEvents().length, 2);
  await throttled.report(token, generateAttackEvent());
  t.same(api.getEvents().length, 3);
  await throttled.report(token, generateAttackEvent());
  t.same(api.getEvents().length, 4);
  await throttled.report(token, generateAttackEvent());
  t.same(api.getEvents().length, 5);
  await throttled.report(token, generateAttackEvent());
  t.same(api.getEvents().length, 5);

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await throttled.report(token, generateAttackEvent());
  t.same(api.getEvents().length, 6);
});

function generateStartedEvent(): Event {
  return {
    type: "started",
    time: Date.now(),
    agent: {
      version: "1.0.0",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      preventedPrototypePollution: false,
      nodeEnv: "",
      os: {
        name: "os",
        version: "version",
      },
      serverless: false,
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

  t.same(api.getEvents().length, 0);
  await throttled.report(token, generateStartedEvent());
  t.same(api.getEvents().length, 1);
  await throttled.report(token, generateStartedEvent());
  t.same(api.getEvents().length, 2);
  await throttled.report(token, generateStartedEvent());
  t.same(api.getEvents().length, 3);
  await throttled.report(token, generateStartedEvent());
  t.same(api.getEvents().length, 4);
  await throttled.report(token, generateStartedEvent());
  t.same(api.getEvents().length, 5);
  await throttled.report(token, generateStartedEvent());
  t.same(api.getEvents().length, 6);
});

function generateHeartbeatEvent(): Event {
  return {
    type: "heartbeat",
    time: Date.now(),
    stats: {},
    agent: {
      version: "1.0.0",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      preventedPrototypePollution: false,
      nodeEnv: "",
      os: {
        name: "os",
        version: "version",
      },
      serverless: false,
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

  t.same(api.getEvents().length, 0);
  await throttled.report(token, generateHeartbeatEvent());
  t.same(api.getEvents().length, 1);
  await throttled.report(token, generateHeartbeatEvent());
  t.same(api.getEvents().length, 2);
  await throttled.report(token, generateHeartbeatEvent());
  t.same(api.getEvents().length, 3);
  await throttled.report(token, generateHeartbeatEvent());
  t.same(api.getEvents().length, 4);
  await throttled.report(token, generateHeartbeatEvent());
  t.same(api.getEvents().length, 5);
  await throttled.report(token, generateHeartbeatEvent());
  t.same(api.getEvents().length, 6);
});
