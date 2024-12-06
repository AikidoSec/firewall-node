import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Koa } from "./Koa";
import { HTTPServer } from "./HTTPServer";
import * as request from "supertest";
import { getContext } from "../agent/Context";
import { addKoaMiddleware } from "../middleware/koa";

const agent = new Agent(
  true,
  new LoggerNoop(),
  new ReportingAPIForTesting({
    success: true,
    endpoints: [
      {
        method: "GET",
        route: "/rate-limited",
        forceProtectionOff: false,
        rateLimiting: {
          windowSizeInMS: 2000,
          maxRequests: 2,
          enabled: true,
        },
      },
    ],
    blockedUserIds: ["567"],
    configUpdatedAt: 0,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    allowedIPAddresses: ["4.3.2.1"],
  }),
  new Token("123"),
  undefined
);
agent.start([new Koa(), new HTTPServer()]);
setInstance(agent);

const koa = require("koa") as typeof import("koa");
const { bodyParser } =
  require("@koa/bodyparser") as typeof import("@koa/bodyparser");

function getApp(routerImport = 1) {
  const app = new koa();
  app.use(bodyParser());

  let Router = require("@koa/router") as typeof import("@koa/router");
  if (routerImport === 2) {
    Router = require("koa-router");
  }

  const router = new Router();

  app.use(async (ctx, next) => {
    if (ctx.path === "/user/blocked") {
      setUser({ id: "567" });
    } else if (ctx.path === "/context/user") {
      setUser({ id: "123" });
    }
    await next();
  });

  addKoaMiddleware(app);

  router.get("/context/user", async (ctx, next) => {
    await next();
    ctx.type = "application/json";
    ctx.body = getContext();
  });

  router.all("/context", (ctx, next) => {
    ctx.type = "application/json";
    ctx.body = getContext();
  });

  router.post("/add/:id", (ctx) => {
    ctx.type = "application/json";
    ctx.body = getContext();
  });

  router.all("/user/blocked", (ctx) => {
    ctx.status = 200;
    ctx.body = "Ok";
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}

t.test("it adds body to the context", async (t) => {
  const app = getApp();
  const response = await request(app.callback())
    .post("/context?title=test")
    .set("Content-Type", "application/json")
    .send({ key: "value", array: [1, 2, 3] });

  t.equal(response.status, 200);
  t.match(response.body, {
    method: "POST",
    query: { title: "test" },
    body: { key: "value", array: [1, 2, 3] },
    cookies: {},
    headers: {
      "content-type": "application/json",
      "content-length": "31",
    },
    source: "koa",
    route: "/context",
    subdomains: [],
  });
});

t.test("it sets the user", async (t) => {
  const app = getApp();
  const response = await request(app.callback()).get("/context/user");

  t.equal(response.status, 200);
  t.match(response.body, {
    method: "GET",
    query: {},
    cookies: {},
    headers: {},
    source: "koa",
    route: "/context/user",
    user: { id: "123" },
    subdomains: [],
  });
});

t.test("it counts requests", async () => {
  const app = getApp();
  agent.getInspectionStatistics().reset();
  await request(app.callback()).get("/");
  await request(app.callback()).post("/");
  t.match(agent.getInspectionStatistics().getStats(), {
    requests: {
      total: 2,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
  });
});

t.test("it blocks a user", async (t) => {
  const app = getApp();
  const response = await request(app.callback()).get("/user/blocked");

  t.equal(response.status, 403);
  t.equal(response.text, "You are blocked by Zen.");
});

t.test("it rate limits a request", async (t) => {
  const app = getApp();
  await request(app.callback()).get("/rate-limited");
  await request(app.callback()).get("/rate-limited");
  const response = await request(app.callback()).get("/rate-limited");

  t.equal(response.status, 429);
  t.match(response.text, "You are rate limited by Zen.");
});

t.test("gets route params using koa router", async (t) => {
  const app = getApp();
  const response = await request(app.callback()).post("/add/123");

  t.equal(response.status, 200);
  t.match(response.body, {
    method: "POST",
    routeParams: {
      id: "123",
    },
    cookies: {},
    headers: {},
    source: "koa",
    route: "/add/:number",
    subdomains: [],
  });
});

t.test("Works with different npm package name", async (t) => {
  const app = getApp(2);
  const response = await request(app.callback()).post("/add/123");

  t.equal(response.status, 200);
  t.match(response.body, {
    method: "POST",
    routeParams: {
      id: "123",
    },
    cookies: {},
    headers: {},
    source: "koa",
    route: "/add/:number",
    subdomains: [],
  });
});
