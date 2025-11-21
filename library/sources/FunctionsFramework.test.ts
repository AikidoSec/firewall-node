import * as t from "tap";
import * as express from "express";
import * as request from "supertest";
import { setTimeout } from "timers/promises";
import type { Event } from "../agent/api/Event";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import {
  createCloudFunctionWrapper,
  FunctionsFramework,
  getFlushEveryMS,
  getTimeoutInMS,
} from "./FunctionsFramework";
import * as asyncHandler from "express-async-handler";
import { createTestAgent } from "../helpers/createTestAgent";
import { Token } from "../agent/api/Token";
import { getInstance } from "../agent/AgentSingleton";
import { isWrapped, wrap } from "../helpers/wrap";

t.beforeEach(async () => {
  delete process.env.AIKIDO_CLOUD_FUNCTION_FLUSH_EVERY_MS;
  delete process.env.AIKIDO_CLOUD_FUNCTION_TIMEOUT_MS;
});

function getExpressApp() {
  const app = express();

  app.set("env", "test");

  app.get(
    "/",
    asyncHandler(
      // @ts-expect-error Test using cloud function wrapper in an express app
      createCloudFunctionWrapper((req, res) => {
        res.sendStatus(200);
      })
    )
  );

  app.get(
    "/error",
    asyncHandler(
      // @ts-expect-error Test using cloud function wrapper in an express app
      createCloudFunctionWrapper((req, res) => {
        throw new Error("error");
      })
    )
  );

  app.get(
    "/context",
    asyncHandler(
      // @ts-expect-error Test using cloud function wrapper in an express app
      createCloudFunctionWrapper((req, res) => {
        res.send(getContext());
      })
    )
  );

  app.get(
    "/attack-detected",
    asyncHandler(
      // @ts-expect-error Test using cloud function wrapper in an express app
      createCloudFunctionWrapper((req, res) => {
        const agent = getInstance();
        if (!agent) {
          throw new Error("Agent not found");
        }
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

        const context = getContext();
        res.send(context);
      })
    )
  );

  return app;
}

t.test("it sets context", async (t) => {
  const app = getExpressApp();

  const response = await request(app).get("/context?search=title");
  const body = JSON.parse(response.text);
  t.match(body, {
    method: "GET",
    query: {
      search: "title",
    },
    cookies: {},
    source: "cloud-function/http",
  });
});

t.test("it counts requests", async (t) => {
  const agent = createTestAgent({
    serverless: "gcp",
  });
  agent.start([]);

  const app = getExpressApp();

  await request(app).get("/");
  t.same(agent.getInspectionStatistics().getStats().requests, {
    total: 1,
    aborted: 0,
    rateLimited: 0,
    attacksDetected: { total: 0, blocked: 0 },
    attackWaves: {
      total: 0,
      blocked: 0,
    },
  });
});

t.test("it counts attacks", async (t) => {
  const agent = createTestAgent({
    serverless: "gcp",
  });
  agent.start([]);

  const app = getExpressApp();

  await request(app).get("/attack-detected");
  t.same(agent.getInspectionStatistics().getStats().requests, {
    total: 1,
    aborted: 0,
    rateLimited: 0,
    attacksDetected: { total: 1, blocked: 1 },
    attackWaves: {
      total: 0,
      blocked: 0,
    },
  });
});

t.test("it counts request if error", async (t) => {
  const agent = createTestAgent({
    serverless: "gcp",
  });
  agent.start([]);

  const app = getExpressApp();

  await request(app).get("/error");
  t.same(agent.getInspectionStatistics().getStats().requests, {
    total: 1,
    aborted: 0,
    rateLimited: 0,
    attacksDetected: { total: 0, blocked: 0 },
    attackWaves: {
      total: 0,
      blocked: 0,
    },
  });
});

t.test("it flushes stats first invoke", async (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api,
    serverless: "gcp",
    token: new Token("123"),
  });
  agent.start([]);

  api.clear();

  const app = getExpressApp();

  await request(app).get("/");

  t.match(api.getEvents(), [{ type: "started" }, { type: "heartbeat" }]);

  await request(app).get("/");

  t.same(api.getEvents().length, 2);
});

t.test("it hooks into functions framework", async () => {
  const agent = createTestAgent({
    serverless: "gcp",
  });
  agent.start([new FunctionsFramework()]);

  const framework =
    require("@google-cloud/functions-framework") as typeof import("@google-cloud/functions-framework");
  framework.http("hello", (req, res) => {
    res.send("Hello, Functions Framework!");
  });

  t.same(isWrapped(framework.http), true);
});

t.test("it discovers routes", async (t) => {
  const agent = createTestAgent({
    serverless: "gcp",
  });
  agent.start([]);

  const app = express();
  app.set("env", "test");

  app.get(
    "/users/:id",
    asyncHandler(
      // @ts-expect-error Test using cloud function wrapper in an express app
      createCloudFunctionWrapper((req, res) => {
        res.sendStatus(200);
      })
    )
  );

  app.get(
    "/posts/:postId/comments/:commentId",
    asyncHandler(
      // @ts-expect-error Test using cloud function wrapper in an express app
      createCloudFunctionWrapper((req, res) => {
        res.sendStatus(200);
      })
    )
  );

  await request(app).get("/users/123");
  await request(app).get("/posts/456/comments/789");

  const routes = agent.getRoutes().asArray();
  t.same(routes.length, 2);
  t.match(routes[0], {
    method: "GET",
    path: "/users/:number",
    hits: 1,
  });
  t.match(routes[1], {
    method: "GET",
    path: "/posts/:number/comments/:number",
    hits: 1,
  });
});

t.test("it waits for attack events to be sent before returning", async (t) => {
  const api = new ReportingAPIForTesting();

  wrap(api, "report", function report(original) {
    return async function report(...args: unknown[]) {
      await setTimeout(100);

      // @ts-expect-error type is unknown
      return original.apply(this, args);
    };
  });

  const agent = createTestAgent({
    api,
    serverless: "gcp",
    token: new Token("123"),
  });
  agent.start([]);

  const wrappedHandler = createCloudFunctionWrapper((req, res) => {
    agent.onDetectedAttack({
      module: "fs",
      operation: "readFile",
      kind: "path_traversal",
      blocked: false,
      source: "body",
      request: getContext(),
      stack: "stack",
      paths: ["file"],
      metadata: {},
      payload: "../etc/passwd",
    });

    agent.onDetectedAttackWave({
      request: getContext()!,
    });

    res.sendStatus(200);
  });

  const mockReq = {
    method: "GET",
    ip: "127.0.0.1",
    body: {},
    protocol: "http",
    get: () => "127.0.0.1",
    originalUrl: "/",
    query: {},
    cookies: {},
    headers: {},
  } as any;

  const mockRes = {
    sendStatus: () => {},
  } as any;

  await wrappedHandler(mockReq, mockRes);

  const events = api.getEvents();
  const attackEvents = events.filter(
    (e) => e.type === "detected_attack" || e.type === "detected_attack_wave"
  );

  t.equal(attackEvents.length, 2, "both attack events should have been sent");
});

t.test("getFlushEveryMS", async (t) => {
  t.equal(
    getFlushEveryMS(),
    10 * 60 * 1000,
    "should return 10 minutes as default"
  );

  process.env.AIKIDO_CLOUD_FUNCTION_FLUSH_EVERY_MS = "120000";
  t.equal(getFlushEveryMS(), 120000, "should return 2 minutes");

  process.env.AIKIDO_CLOUD_FUNCTION_FLUSH_EVERY_MS = "invalid";
  t.equal(
    getFlushEveryMS(),
    10 * 60 * 1000,
    "should return 10 minutes as default for non-numeric"
  );

  process.env.AIKIDO_CLOUD_FUNCTION_FLUSH_EVERY_MS = "30000";
  t.equal(
    getFlushEveryMS(),
    10 * 60 * 1000,
    "should return 10 minutes as default for value below minimum"
  );

  process.env.AIKIDO_CLOUD_FUNCTION_FLUSH_EVERY_MS = "60000";
  t.equal(
    getFlushEveryMS(),
    60000,
    "should return 1 minute at minimum threshold"
  );
});

t.test("getTimeoutInMS", async (t) => {
  t.equal(getTimeoutInMS(), 1000, "should return 1 second as default");

  process.env.AIKIDO_CLOUD_FUNCTION_TIMEOUT_MS = "5000";
  t.equal(getTimeoutInMS(), 5000, "should return 5 seconds");

  process.env.AIKIDO_CLOUD_FUNCTION_TIMEOUT_MS = "invalid";
  t.equal(
    getTimeoutInMS(),
    1000,
    "should return 1 second as default for non-numeric"
  );

  process.env.AIKIDO_CLOUD_FUNCTION_TIMEOUT_MS = "500";
  t.equal(
    getTimeoutInMS(),
    1000,
    "should return 1 second as default for value below minimum"
  );

  process.env.AIKIDO_CLOUD_FUNCTION_TIMEOUT_MS = "1000";
  t.equal(
    getTimeoutInMS(),
    1000,
    "should return 1 second at minimum threshold"
  );
});
