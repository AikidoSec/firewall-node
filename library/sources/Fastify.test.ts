import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Fastify } from "./Fastify";
import { HTTPServer } from "./HTTPServer";
import { FileSystem } from "../sinks/FileSystem";

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
          maxRequests: 3,
          enabled: true,
        },
      },
      {
        method: "GET",
        route: "/user-rate-limited",
        forceProtectionOff: false,
        rateLimiting: {
          windowSizeInMS: 2000,
          maxRequests: 3,
          enabled: true,
        },
      },
      {
        method: "GET",
        route: "/white-listed-ip-address",
        forceProtectionOff: false,
        rateLimiting: {
          windowSizeInMS: 2000,
          maxRequests: 3,
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
agent.start([new Fastify(), new HTTPServer(), new FileSystem()]);
setInstance(agent);

import fastify from "fastify";
import { getContext } from "../agent/Context";

function getApp() {
  const app = fastify();

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Powered-By", "Aikido");
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/on-request-attack")) {
      // @ts-expect-error not typed here
      if (typeof request.query.directory !== "string") {
        reply.code(400).send("directory query parameter is required");
        return;
      }
      // @ts-expect-error not typed here
      require("fs").readdir(request.query.directory).unref();

      reply.send(getContext());
    }
  });

  app.get("/", (request, reply) => {
    const context = getContext();
    reply.code(200).header("Content-Type", "application/json").send(context);
  });

  app.all("/context", (request, reply) => {
    const context = getContext();
    reply.code(200).header("Content-Type", "application/json").send(context);
  });

  return app;
}

t.test("it adds context from request for all", async (t) => {
  const app = getApp();
  await app.listen({ port: 4123 });
  await app.ready();

  const response = await fetch("http://127.0.0.1:4123/?title[$ne]=null", {
    headers: {
      accept: "application/json",
      cookie: "session=123",
    },
  });
  t.same(response.status, 200);

  const json = await response.json();
  t.same(json, {
    url: "/?title[$ne]=null",
    remoteAddress: "127.0.0.1",
    method: "GET",
    query: { "title[$ne]": "null" },
    headers: {
      accept: "application/json",
      cookie: "session=123",
      host: "127.0.0.1:4123",
      connection: "keep-alive",
      "accept-language": "*",
      "sec-fetch-mode": "cors",
      "user-agent": "node",
      "accept-encoding": "gzip, deflate",
    },
    routeParams: {},
    source: "fastify",
    route: "/",
    cookies: {},
  });

  await app.close();
});

t.test("it adds context from request for POST to all", async (t) => {
  const app = getApp();
  await app.listen({ port: 4123 });
  await app.ready();

  const response = await fetch("http://127.0.0.1:4123/context", {
    method: "POST",
    headers: {
      accept: "application/json",
      cookie: "session=123",
    },
  });
  t.same(response.status, 200);

  const json = await response.json();
  t.same(json, {
    url: "/context",
    remoteAddress: "127.0.0.1",
    method: "POST",
    query: {},
    headers: {
      accept: "application/json",
      cookie: "session=123",
      host: "127.0.0.1:4123",
      connection: "keep-alive",
      "accept-language": "*",
      "sec-fetch-mode": "cors",
      "user-agent": "node",
      "accept-encoding": "gzip, deflate",
      "content-length": "0",
    },
    routeParams: {},
    source: "fastify",
    route: "/context",
    cookies: {},
  });

  await app.close();
});

t.test("it blocks request in on-request hook", async (t) => {
  const app = getApp();
  await app.listen({ port: 4123 });
  await app.ready();

  const response = await fetch(
    "http://127.0.0.1:4123/on-request-attack?directory=/etc/",
    {
      headers: {
        accept: "application/json",
      },
    }
  );

  t.same(response.status, 500);

  const text = await response.text();
  t.match(
    text,
    /Aikido firewall has blocked a path traversal attack: fs.readdir.* originating from query.directory/
  );

  await app.close();
});
