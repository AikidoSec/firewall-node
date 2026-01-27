import * as t from "tap";
import { setInstance } from "../agent/AgentSingleton";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Agent } from "../agent/Agent";
import { Koa } from "./Koa";
import { HTTPServer } from "./HTTPServer";
import * as request from "supertest";
import { getContext } from "../agent/Context";
import { addKoaMiddleware } from "../middleware/koa";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { FetchListsAPIForTesting } from "../agent/api/FetchListsAPIForTesting";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";

// Async needed because `require(...)` is translated to `await import(..)` when running tests in ESM mode
export async function createKoaRouterTests(koaRouterPackageName: string) {
  const options = {
    skip:
      getMajorNodeVersion() < 18 ? "Does not support Node.js < 18" : undefined,
  };

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
    undefined,
    false,
    new FetchListsAPIForTesting()
  );
  agent.start([new Koa(), new HTTPServer()]);
  setInstance(agent);

  let koa = require("koa") as typeof import("koa");

  if (isEsmUnitTest()) {
    // @ts-expect-error default export missing types
    koa = koa.default;
  }

  const { bodyParser } =
    require("@koa/bodyparser") as typeof import("@koa/bodyparser");

  async function getApp() {
    const app = new koa();
    app.use(bodyParser());

    let Router = require(koaRouterPackageName) as typeof import("@koa/router");

    if (isEsmUnitTest()) {
      // @ts-expect-error default export missing types
      Router = Router.default;
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

    router.get("/", (ctx) => {
      ctx.body = "Hello World";
    });

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

  t.test("it adds body to the context", options, async (t) => {
    const app = await getApp();
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

  t.test("it sets the user", options, async (t) => {
    const app = await getApp();
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

  t.test("it counts requests", options, async () => {
    const app = await getApp();
    agent.getInspectionStatistics().reset();
    await request(app.callback()).get("/");
    await request(app.callback()).post("/"); // It does not count 404
    t.match(agent.getInspectionStatistics().getStats(), {
      requests: {
        total: 1,
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
      },
    });
  });

  t.test("it blocks a user", options, async (t) => {
    const app = await getApp();
    const response = await request(app.callback()).get("/user/blocked");

    t.equal(response.status, 403);
    t.equal(response.text, "You are blocked by Zen.");
  });

  t.test("it rate limits a request", options, async (t) => {
    const app = await getApp();
    await request(app.callback()).get("/rate-limited");
    await request(app.callback()).get("/rate-limited");
    const response = await request(app.callback()).get("/rate-limited");

    t.equal(response.status, 429);
    t.match(response.text, "You are rate limited by Zen.");
  });

  t.test("gets route params using koa router", options, async (t) => {
    const app = await getApp();
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
}
