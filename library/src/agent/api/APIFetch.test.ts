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
  t.same(seen[0].token, "123");
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
