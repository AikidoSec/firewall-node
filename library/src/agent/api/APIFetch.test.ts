import { json } from "express";
import * as asyncHandler from "express-async-handler";
import * as t from "tap";
import { APIFetch } from "./APIFetch";
import { Event } from "./Event";
import { Token } from "./Token";
import express = require("express");

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

type SeenPayload = { token: string; body: unknown };
type StopServer = () => Promise<SeenPayload[]>;

function createTestEndpoint({
  statusCode,
  sleepInMs,
  port,
}: {
  sleepInMs?: number;
  statusCode?: number;
  port: number;
}): Promise<StopServer> {
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

      if (statusCode) {
        res.status(statusCode);
      }

      res.send({ success: true });
    })
  );

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      resolve(() => {
        return new Promise((resolve) =>
          server.close(() => {
            resolve(seen);
          })
        );
      });
    });
  });
}

t.test("it reports event to API endpoint", async () => {
  const stop = await createTestEndpoint({ port: 3000 });
  const api = new APIFetch(new URL("http://localhost:3000"), 1000);
  t.same(await api.report(new Token("123"), generateStartedEvent()), {
    success: true,
  });
  const seen = await stop();
  t.same(seen.length, 1);
  t.same(seen[0].token, "123");
  // @ts-expect-error Type is not known
  t.same(seen[0].body.type, "started");
});

t.test("it respects timeout", async () => {
  const stop = await createTestEndpoint({ sleepInMs: 2000, port: 3001 });
  const api = new APIFetch(new URL("http://localhost:3001"), 1000);
  const start = performance.now();
  t.same(await api.report(new Token("123"), generateStartedEvent()), {
    success: false,
    error: "timeout",
  });
  const finish = performance.now();
  // Added 200ms to prevent flakiness
  t.same(finish - start < 1200, true);
  await stop();
});

t.test("it deals with 429", async () => {
  const stop = await createTestEndpoint({ statusCode: 429, port: 3002 });
  const api = new APIFetch(new URL("http://localhost:3002"), 1000);
  t.same(await api.report(new Token("123"), generateStartedEvent()), {
    success: false,
    error: "rate_limited",
  });
  await stop();
});

t.test("it deals with 401", async () => {
  const stop = await createTestEndpoint({ statusCode: 401, port: 3003 });
  const api = new APIFetch(new URL("http://localhost:3003"), 1000);
  t.same(await api.report(new Token("123"), generateStartedEvent()), {
    success: false,
    error: "invalid_token",
  });
  await stop();
});
