import * as t from "tap";
import * as express from "express";
import * as request from "supertest";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import {
  createCloudFunctionWrapper,
  FunctionsFramework,
} from "./FunctionsFramework";
import * as asyncHandler from "express-async-handler";
import { createTestAgent } from "../helpers/createTestAgent";
import { Token } from "../agent/api/Token";
import { getInstance } from "../agent/AgentSingleton";
import { isWrapped } from "../helpers/wrap";

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

  t.match(api.getEvents(), [{ type: "heartbeat" }]);

  await request(app).get("/");

  t.same(api.getEvents().length, 1);
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
