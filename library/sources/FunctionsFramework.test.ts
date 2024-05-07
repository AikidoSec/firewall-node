import * as t from "tap";
import * as express from "express";
import * as request from "supertest";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { ConfigAPIForTesting } from "../agent/config-api/ConfigAPIForTesting";
import { Token } from "../agent/Token";
import { getContext } from "../agent/Context";
import { LoggerForTesting } from "../agent/logger/LoggerForTesting";
import {
  createCloudFunctionWrapper,
  FunctionsFramework,
} from "./FunctionsFramework";
import * as asyncHandler from "express-async-handler";

function getExpressApp() {
  const app = express();

  app.set("env", "test");

  app.get(
    "/",
    asyncHandler(
      createCloudFunctionWrapper((req, res) => {
        res.sendStatus(200);
      })
    )
  );

  app.get(
    "/error",
    asyncHandler(
      createCloudFunctionWrapper((req, res) => {
        throw new Error("error");
      })
    )
  );

  app.get(
    "/context",
    asyncHandler(
      createCloudFunctionWrapper((req, res) => {
        res.send(getContext());
      })
    )
  );

  app.get(
    "/attack-detected",
    asyncHandler(
      createCloudFunctionWrapper((req, res) => {
        const context = getContext();
        context.attackDetected = true;
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
  const logger = new LoggerForTesting();
  const agent = new Agent(
    true,
    logger,
    new ReportingAPIForTesting(),
    undefined,
    "gcp",
    new ConfigAPIForTesting()
  );
  agent.start([]);
  setInstance(agent);

  const app = getExpressApp();

  await request(app).get("/");
  t.same(agent.getInspectionStatistics().getStats().requests, {
    total: 1,
    attacksDetected: { total: 0, blocked: 0 },
  });
});

t.test("it counts attacks", async (t) => {
  const logger = new LoggerForTesting();
  const agent = new Agent(
    true,
    logger,
    new ReportingAPIForTesting(),
    undefined,
    "gcp",
    new ConfigAPIForTesting()
  );
  agent.start([]);
  setInstance(agent);

  const app = getExpressApp();

  await request(app).get("/attack-detected");
  t.same(agent.getInspectionStatistics().getStats().requests, {
    total: 1,
    attacksDetected: { total: 1, blocked: 1 },
  });
});

t.test("it counts request if error", async (t) => {
  const logger = new LoggerForTesting();
  const agent = new Agent(
    true,
    logger,
    new ReportingAPIForTesting(),
    undefined,
    "gcp",
    new ConfigAPIForTesting()
  );
  agent.start([]);
  setInstance(agent);

  const app = getExpressApp();

  await request(app).get("/error");
  t.same(agent.getInspectionStatistics().getStats().requests, {
    total: 1,
    attacksDetected: { total: 0, blocked: 0 },
  });
});

t.test("it flushes stats first invoke", async (t) => {
  const logger = new LoggerForTesting();
  const api = new ReportingAPIForTesting();
  const agent = new Agent(
    true,
    logger,
    api,
    new Token("123"),
    "gcp",
    new ConfigAPIForTesting()
  );
  agent.start([]);
  setInstance(agent);

  api.clear();

  const app = getExpressApp();

  await request(app).get("/");

  t.match(api.getEvents(), [{ type: "heartbeat" }]);

  await request(app).get("/");

  t.same(api.getEvents().length, 1);
});

t.test("it hooks into functions framework", async () => {
  const logger = new LoggerForTesting();
  const agent = new Agent(
    true,
    logger,
    new ReportingAPIForTesting(),
    undefined,
    "gcp",
    new ConfigAPIForTesting()
  );
  agent.start([new FunctionsFramework()]);
  setInstance(agent);

  const framework = require("@google-cloud/functions-framework");
  framework.http("hello", (req, res) => {
    res.send("Hello, Functions Framework!");
  });
});
