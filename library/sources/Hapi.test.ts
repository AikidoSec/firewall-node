import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { Hapi } from "./Hapi";
import { FileSystem } from "../sinks/FileSystem";
import { HTTPServer } from "./HTTPServer";
import { createTestAgent } from "../helpers/createTestAgent";
import { addHapiMiddleware } from "../middleware/hapi";

const agent = createTestAgent({
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
});
agent.start([new Hapi(), new FileSystem(), new HTTPServer()]);

import * as request from "supertest";
import { getContext } from "../agent/Context";

// Async needed because `require(...)` is translated to `await import(..)` when running tests in ESM mode
async function getServer(onRequestExt = true) {
  const hapi = require("@hapi/hapi") as typeof import("@hapi/hapi");

  const server = hapi.server({
    port: 4567,
    host: "127.0.0.1",
  });

  server.route({
    method: "GET",
    path: "/",
    handler: (request, h) => {
      return getContext();
    },
  });

  server.decorate("toolkit", "success", function success() {
    return this.response({ status: "ok" });
  });

  server.route([
    {
      method: "*",
      path: "/context",
      handler: (request, h) => {
        return getContext();
      },
    },
    {
      method: "GET",
      path: "/rate-limited",
      handler: (request, h) => {
        return "OK";
      },
    },
    {
      method: "GET",
      path: "/blocked-user",
      handler: (request, h) => {
        return "OK - you are not blocked";
      },
    },
    {
      method: "GET",
      path: "/options-handler",
      options: {
        handler: (request, h) => {
          return getContext();
        },
      },
    },
    {
      method: "GET",
      path: "/success",
      handler: (request, h) => {
        // @ts-expect-error Not typed
        return h.success();
      },
    },
  ]);

  server.decorate(
    "handler",
    "customHandler",
    function customHandler(route, options) {
      return function customHandlerOnRequest(request, h) {
        return h.response(getContext()).code(200);
      };
    }
  );

  server.route({
    method: "GET",
    path: "/decorate-handler",
    handler: {
      customHandler: {},
    },
  });

  if (onRequestExt) {
    server.ext("onRequest", (request, h) => {
      if (request.url.pathname === "/blocked-user") {
        setUser({ id: "567" });
      }
      return h.continue;
    });
  }

  addHapiMiddleware(server);

  return server;
}

t.test("it adds context from request for GET", async (t) => {
  const response = await request((await getServer()).listener)
    .get("/?title=test")
    .set("Accept", "application/json")
    .set("Cookie", "session=123")
    .set("X-Forwarded-For", "1.2.3.4");

  t.match(response.body, {
    method: "GET",
    query: { title: "test" },
    cookies: { session: "123" },
    headers: { accept: "application/json", cookie: "session=123" },
    remoteAddress: "1.2.3.4",
    source: "hapi",
    route: "/",
  });

  t.match(response.body.url, /^http:\/\/.*\/\?title=test$/);
});

t.test("it adds context from POST with JSON body", async (t) => {
  const response = await request((await getServer()).listener)
    .post("/context")
    .set("Accept", "application/json")
    .set("Content-Type", "application/json")
    .set("X-Forwarded-For", "1.2.3.4")
    .send({ content: "test", abc: [] });

  t.match(response.body, {
    method: "POST",
    query: {},
    cookies: {},
    headers: { accept: "application/json" },
    remoteAddress: "1.2.3.4",
    source: "hapi",
    route: "/context",
    body: { content: "test", abc: [] },
  });
});

t.test("it wraps options.handler", async (t) => {
  const response = await request((await getServer()).listener)
    .get("/options-handler?title=test")
    .set("Accept", "application/json")
    .set("X-Forwarded-For", "1.2.3.4");

  t.match(response.body, {
    method: "GET",
    query: { title: "test" },
    headers: { accept: "application/json" },
    remoteAddress: "1.2.3.4",
    source: "hapi",
    route: "/options-handler",
  });
});

t.test("it adds context from POST with form body", async (t) => {
  const response = await request((await getServer()).listener)
    .post("/context")
    .set("Accept", "application/json")
    .set("Content-Type", "application/x-www-form-urlencoded")
    .set("X-Forwarded-For", "1.2.3.4")
    .send("content=test&abc=123");

  t.match(response.body, {
    method: "POST",
    query: {},
    cookies: {},
    headers: { accept: "application/json" },
    remoteAddress: "1.2.3.4",
    source: "hapi",
    route: "/context",
    body: { content: "test", abc: "123" },
  });
});

t.test("it rate limits based on IP address", async (t) => {
  const response = await request((await getServer()).listener)
    .get("/rate-limited")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response.status, 200);
  t.match(response.text, "OK");

  const response2 = await request((await getServer()).listener)
    .get("/rate-limited")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response2.status, 200);
  t.match(response2.text, "OK");

  const response3 = await request((await getServer()).listener)
    .get("/rate-limited")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response3.status, 429);
  t.match(response3.text, "You are rate limited by Zen. (Your IP: 1.2.3.4)");
});

t.test("it blocks based on user ID", async (t) => {
  const response = await request((await getServer()).listener)
    .get("/blocked-user")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response.status, 403);
  t.match(response.text, "You are blocked by Zen.");
});

t.test("it gets context from decorate handler", async (t) => {
  const response = await request((await getServer()).listener)
    .get("/decorate-handler?query=123")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response.body, {
    method: "GET",
    query: { query: "123" },
    cookies: {},
    headers: {},
    remoteAddress: "1.2.3.4",
    source: "hapi",
    route: "/decorate-handler",
  });
});

t.test("it gets context from decorate handler", async (t) => {
  const response = await request((await getServer(false)).listener)
    .get("/decorate-handler?query=123")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response.body, {
    method: "GET",
    query: { query: "123" },
    cookies: {},
    headers: {},
    remoteAddress: "1.2.3.4",
    source: "hapi",
    route: "/decorate-handler",
  });
});

t.test("toolkit decorator success works", async (t) => {
  const response = await request((await getServer()).listener).get("/success");
  t.match(response.body, { status: "ok" });
});

t.test("it respects forwarded host header", async (t) => {
  const response = await request(getServer().listener)
    .get("/?title=test")
    .set("Accept", "application/json")
    .set("Cookie", "session=123")
    .set("X-Forwarded-Host", "example.com")
    .set("X-Forwarded-Protocol", "https")
    .set("X-Forwarded-For", "1.2.3.4");

  t.match(response.body, {
    method: "GET",
    url: "https://example.com/?title=test",
    urlPath: "/",
    query: { title: "test" },
    cookies: { session: "123" },
    headers: { accept: "application/json", cookie: "session=123" },
    remoteAddress: "1.2.3.4",
    source: "hapi",
    route: "/",
  });
});
