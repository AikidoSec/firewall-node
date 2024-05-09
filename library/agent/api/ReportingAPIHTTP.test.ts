import * as express from "express";
import * as asyncHandler from "express-async-handler";
import * as t from "tap";
import { HttpClientNodeHttp } from "../http/HttpClientNodeHttp";
import { ReportingAPIHTTP } from "./ReportingAPIHTTP";
import { Event } from "./Event";
import { Token } from "./Token";

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
      incompatiblePackages: {
        prototypePollution: {},
      },
      stack: [],
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
  endpoints,
  throwError,
}: {
  sleepInMs?: number;
  statusCode?: number;
  port: number;
  endpoints?: { route: string; method: string; forceProtectionOff: boolean }[];
  throwError?: boolean;
}): Promise<StopServer> {
  const seen: SeenPayload[] = [];

  const app = express();
  app.set("env", "test");
  app.use(express.json());

  app.get(
    "/api/runtime/config",
    asyncHandler(async (req, res) => {
      res.send({
        success: true,
        endpoints: endpoints,
      });
    })
  );

  app.post(
    "/api/runtime/events",
    asyncHandler(async (req, res) => {
      if (sleepInMs) {
        await new Promise((resolve) => setTimeout(resolve, sleepInMs));
      }

      seen.push({
        token: req.header("Authorization") || "",
        body: req.body,
      });

      if (throwError) {
        throw new Error("500");
      }

      if (statusCode) {
        res.status(statusCode);
      }

      res.send({
        success: true,
        endpoints: endpoints,
      });
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
  const api = new ReportingAPIHTTP(
    new URL("http://localhost:3000/api/runtime/events"),
    new HttpClientNodeHttp()
  );
  t.same(await api.report(new Token("123"), generateStartedEvent(), 1000), {
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
  const api = new ReportingAPIHTTP(
    new URL("http://localhost:3001/api/runtime/events"),
    new HttpClientNodeHttp()
  );
  const start = performance.now();
  t.same(await api.report(new Token("123"), generateStartedEvent(), 1000), {
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
  const api = new ReportingAPIHTTP(
    new URL("http://localhost:3002/api/runtime/events"),
    new HttpClientNodeHttp()
  );
  t.same(await api.report(new Token("123"), generateStartedEvent(), 1000), {
    success: false,
    error: "rate_limited",
  });
  await stop();
});

t.test("it deals with 401", async () => {
  const stop = await createTestEndpoint({ statusCode: 401, port: 3003 });
  const api = new ReportingAPIHTTP(
    new URL("http://localhost:3003/api/runtime/events"),
    new HttpClientNodeHttp()
  );
  t.same(await api.report(new Token("123"), generateStartedEvent(), 1000), {
    success: false,
    error: "invalid_token",
  });
  await stop();
});

t.test("it parses JSON", async () => {
  const stop = await createTestEndpoint({
    port: 3004,
    endpoints: [{ route: "/route", method: "GET", forceProtectionOff: false }],
  });
  const api = new ReportingAPIHTTP(
    new URL("http://localhost:3004/api/runtime/events"),
    new HttpClientNodeHttp()
  );
  t.same(await api.report(new Token("123"), generateStartedEvent(), 1000), {
    success: true,
    endpoints: [{ route: "/route", method: "GET", forceProtectionOff: false }],
  });
  await stop();
});

t.test("it deals with malformed JSON", async () => {
  const stop = await createTestEndpoint({ port: 3005, throwError: true });
  const api = new ReportingAPIHTTP(
    new URL("http://localhost:3005/api/runtime/events"),
    new HttpClientNodeHttp()
  );
  t.same(await api.report(new Token("123"), generateStartedEvent(), 1000), {
    success: false,
    error: "unknown_error",
  });
  await stop();
});

t.test("it gets config", async () => {
  const stop = await createTestEndpoint({
    port: 3006,
    endpoints: [{ route: "/config", method: "GET", forceProtectionOff: false }],
  });
  const api = new ReportingAPIHTTP(
    new URL("http://localhost:3006/api/runtime/events"),
    new HttpClientNodeHttp()
  );
  t.same(await api.getConfig(new Token("123"), 1000), {
    success: true,
    endpoints: [{ route: "/config", method: "GET", forceProtectionOff: false }],
  });
  await stop();
});
