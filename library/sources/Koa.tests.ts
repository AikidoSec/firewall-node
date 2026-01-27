import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { Koa } from "./Koa";
import { HTTPServer } from "./HTTPServer";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import * as request from "supertest";
import { getContext } from "../agent/Context";
import { addKoaMiddleware } from "../middleware/koa";
import { startTestAgent } from "../helpers/startTestAgent";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";

// Async needed because `require(...)` is translated to `await import(..)` when running tests in ESM mode
export async function createKoaTests(koaPackageName: string) {
  const agent = startTestAgent({
    block: true,
    api: new ReportingAPIForTesting({
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
    token: new Token("123"),
    serverless: undefined,
    wrappers: [new Koa(), new HTTPServer()],
    rewrite: {
      koa: koaPackageName,
    },
  });

  let koa = require(koaPackageName) as typeof import("koa");

  if (isEsmUnitTest()) {
    // @ts-expect-error default export missing types
    koa = koa.default;
  }

  const { bodyParser } =
    require("@koa/bodyparser") as typeof import("@koa/bodyparser");

  function getApp() {
    const app = new koa();
    app.use(bodyParser());

    // Sync middleware
    app.use((ctx, next) => {
      return next().then(() => {
        ctx.response.set("x-powered-by", "aikido");
      });
    });

    // Async middleware
    app.use(async (ctx, next) => {
      if (ctx.path === "/user/blocked") {
        setUser({ id: "567" });
      } else if (ctx.path === "/context/user") {
        setUser({ id: "123" });
      }
      await next();
    });

    addKoaMiddleware(app);

    app.use(async (ctx, next) => {
      await next();
      if (ctx.path.startsWith("/context")) {
        ctx.type = "application/json";
        ctx.body = getContext();
      }
      if (ctx.path === "/") {
        ctx.body = "Hello World";
      }
    });

    // v1 Generator function middleware
    if (koaPackageName === "koa-v2") {
      app.use(function* test(next) {
        yield next;
        // @ts-expect-error don't have types for this
        if (this.path === "/v1") {
          // @ts-expect-error don't have types for this
          this.type = "text/plain";
          // @ts-expect-error don't have types for this
          this.body = "v1";
        }
      });
    } else {
      app.use(async (ctx, next) => {
        await next();
        if (ctx.path === "/v1") {
          ctx.type = "text/plain";
          ctx.body = "v1";
        }
      });
    }

    app.use(async (ctx, next) => {
      await next();
      if (ctx.path.startsWith("/user")) {
        ctx.type = "text/plain";
        ctx.body = "OK";
      }
    });

    return app;
  }

  t.test("adds context to the request", async (t) => {
    const app = getApp();
    const response = await request(app.callback())
      .get("/context?title=test&a=1")
      .set("Cookie", "session=123")
      .set("Accept", "application/json");

    t.equal(response.status, 200);
    t.match(response.body, {
      method: "GET",
      query: { title: "test", a: "1" },
      cookies: { session: "123" },
      headers: { accept: "application/json", cookie: "session=123" },
      source: "koa",
      route: "/context",
      subdomains: [],
    });
    t.ok(isLocalhostIP(response.body.remoteAddress));
    t.match(response.headers, {
      "x-powered-by": "aikido",
    });

    // Url is absolute and includes query parameters
    t.match(response.body.url, /^http:\/\/.*\/context\?title=test&a=1$/);
  });

  t.test("it sets the user", async (t) => {
    const app = getApp();
    const response = await request(app.callback()).post("/context/user");

    t.equal(response.status, 200);
    t.match(response.body, {
      method: "POST",
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
        aborted: 0,
        rateLimited: 0,
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

  t.test("test legacy generator function middleware", async (t) => {
    const app = getApp();
    const response = await request(app.callback()).get("/v1");

    t.equal(response.status, 200);
    t.equal(response.text, "v1");
  });

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

  t.test("it respects forwarded host header", async (t) => {
    const app = getApp();
    const response = await request(app.callback())
      .get("/context?title=test&a=1")
      .set("Cookie", "session=123")
      .set("Accept", "application/json")
      .set("X-Forwarded-Host", "example.com")
      .set("X-Forwarded-Proto", "https");

    t.equal(response.status, 200);
    t.match(response.body, {
      url: "https://example.com/context?title=test&a=1",
      method: "GET",
      query: { title: "test", a: "1" },
      cookies: { session: "123" },
      headers: { accept: "application/json", cookie: "session=123" },
      source: "koa",
      route: "/context",
      subdomains: [],
    });
    t.ok(isLocalhostIP(response.body.remoteAddress));
    t.match(response.headers, {
      "x-powered-by": "aikido",
    });
  });
}
