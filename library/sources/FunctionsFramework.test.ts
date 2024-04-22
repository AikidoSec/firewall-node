import * as t from "tap";
import * as express from "express";
import * as request from "supertest";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Token } from "../agent/api/Token";
import { getContext } from "../agent/Context";
import { LoggerForTesting } from "../agent/logger/LoggerForTesting";
import { createCloudFunctionWrapper } from "./FunctionsFramework";
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
  const agent = new Agent(true, logger, new APIForTesting(), undefined, "gcp");
  agent.start([]);
  setInstance(agent);

  const app = getExpressApp();

  await request(app).get("/");
  t.same(agent.getInspectionStatistics().getStats().requests, {
    total: 1,
    attacksDetected: { total: 0, blocked: 0 },
  });
});

t.test("it counts request if error", async (t) => {
  const logger = new LoggerForTesting();
  const agent = new Agent(true, logger, new APIForTesting(), undefined, "gcp");
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
  const api = new APIForTesting();
  const agent = new Agent(true, logger, api, new Token("123"), "gcp");
  agent.start([]);
  setInstance(agent);

  api.clear();

  const app = getExpressApp();

  await request(app).get("/");

  t.match(api.getEvents(), [{ type: "heartbeat" }]);

  await request(app).get("/");

  t.same(api.getEvents().length, 1);
});
