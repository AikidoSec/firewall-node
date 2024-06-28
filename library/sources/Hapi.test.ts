import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Hapi } from "./Hapi";
import { FileSystem } from "../sinks/FileSystem";
import { HTTPServer } from "./HTTPServer";

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
agent.start([new Hapi(), new FileSystem(), new HTTPServer()]);
setInstance(agent);

import * as hapi from "@hapi/hapi";
import * as request from "supertest";
import { getContext } from "../agent/Context";

function getServer() {
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
  ]);

  server.decorate("handler", "customHandler", (route, options) => {
    return (request, h) => {
      return h.response(getContext()).code(200);
    };
  });

  server.route({
    method: "GET",
    path: "/decorate-handler",
    handler: {
      customHandler: {},
    },
  });

  server.ext("onRequest", (request, h) => {
    if (request.url.pathname === "/blocked-user") {
      setUser({ id: "567" });
    }
    return h.continue;
  });

  return server;
}

t.test("it adds context from request for GET", async (t) => {
  const response = await request(getServer().listener)
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
});

t.test("it adds context from POST with JSON body", async (t) => {
  const response = await request(getServer().listener)
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
  const response = await request(getServer().listener)
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
  const response = await request(getServer().listener)
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
  const response = await request(getServer().listener)
    .get("/rate-limited")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response.status, 200);
  t.match(response.text, "OK");

  const response2 = await request(getServer().listener)
    .get("/rate-limited")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response2.status, 200);
  t.match(response2.text, "OK");

  const response3 = await request(getServer().listener)
    .get("/rate-limited")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response3.status, 429);
  t.match(
    response3.text,
    "You are rate limited by Aikido firewall. (Your IP: 1.2.3.4)"
  );
});

t.test("it blocks based on user ID", async (t) => {
  const response = await request(getServer().listener)
    .get("/blocked-user")
    .set("X-Forwarded-For", "1.2.3.4");
  t.match(response.status, 403);
  t.match(response.text, "You are blocked by Aikido firewall.");
});

t.test("it gets context from decorate handler", async (t) => {
  const response = await request(getServer().listener)
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
