import * as t from "tap";
import { APIForTesting, APIThrottled, Token, Event, APIFetch } from "./API";
import express = require("express");
import { json } from "express";
import * as asyncHandler from "express-async-handler";

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
      id: "id",
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
      id: "id",
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

type SeenPayload = { token: string; body: unknown };
type StopServer = () => Promise<SeenPayload[]>;

function createTestEndpoint(sleepInMs?: number): StopServer {
  const seen: SeenPayload[] = [];

  const app = express();
  app.use(json());
  app.post(
    "*",
    asyncHandler(async (req, res) => {
      if (sleepInMs) {
        await new Promise((resolve) => setTimeout(resolve, sleepInMs));
      }

      seen.push({
        token: req.header("Authorization") || "",
        body: req.body,
      });

      res.send({ success: true });
    })
  );

  const server = app.listen(3000);

  return () => {
    return new Promise((resolve) =>
      server.close(() => {
        resolve(seen);
      })
    );
  };
}

t.test("it reports event to API endpoint", async () => {
  const stop = createTestEndpoint();
  const api = new APIFetch(new URL("http://localhost:3000"), 1000);
  await api.report(new Token("123"), generateStartedEvent());
  const seen = await stop();
  t.same(seen.length, 1);
  t.same(seen[0].token, "Bearer 123");
  // @ts-expect-error Type is not known
  t.same(seen[0].body.type, "started");
});

t.test("it respects timeout", async () => {
  const stop = createTestEndpoint(2000);
  const api = new APIFetch(new URL("http://localhost:3000"), 1000);
  const start = performance.now();
  await api.report(new Token("123"), generateStartedEvent());
  const finish = performance.now();
  // Added 200ms to prevent flakiness
  t.same(finish - start < 1200, true);
  await stop();
});

t.test("it throws error if token is empty", async () => {
  t.throws(() => new Token(""));
});
