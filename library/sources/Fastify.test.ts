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
import type { FastifyInstance } from "fastify";

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

import { getContext } from "../agent/Context";

function getApp(
  importType: "default" | "fastify" | "defaultNamed" = "default"
) {
  let app: FastifyInstance;

  if (importType === "default") {
    app = require("fastify")();
  } else if (importType === "fastify") {
    const { fastify } = require("fastify");
    app = fastify();
  } else if (importType === "defaultNamed") {
    const fastify = require("fastify").default;
    app = fastify();
  } else {
    throw new Error("Unknown import type");
  }

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Powered-By", "Aikido");

    if (request.url.startsWith("/blocked-user")) {
      setUser({ id: "567", name: "User" });
    }
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

  app.route({
    method: "GET",
    url: "/rate-limited",
    handler: async (request, reply) => {
      reply.code(200).send("ok");
    },
  });

  app.get("/blocked-user", (request, reply) => {
    reply.code(200).send("ok");
  });

  return app;
}

t.test("it adds context from request for all", async (t) => {
  const app = getApp();

  const response = await app.inject({
    method: "GET",
    url: "/?title[$ne]=null",
    headers: {
      accept: "application/json",
      cookie: "session=123",
    },
  });

  t.same(response.statusCode, 200);

  const json = await response.json();
  t.same(json, {
    url: "/?title[$ne]=null",
    remoteAddress: "127.0.0.1",
    method: "GET",
    query: { "title[$ne]": "null" },
    headers: {
      accept: "application/json",
      cookie: "session=123",
      "user-agent": "lightMyRequest",
      host: "localhost:80",
    },
    routeParams: {},
    source: "fastify",
    route: "/",
    cookies: {},
  });
});

t.test("it adds context from request by using default import", async (t) => {
  const app = getApp("default");

  const response = await app.inject({
    method: "GET",
    url: "/?title[$ne]=null",
    headers: {
      accept: "application/json",
      cookie: "session=123",
    },
  });

  t.same(response.statusCode, 200);

  const json = await response.json();
  t.same(json, {
    url: "/?title[$ne]=null",
    remoteAddress: "127.0.0.1",
    method: "GET",
    query: { "title[$ne]": "null" },
    headers: {
      accept: "application/json",
      cookie: "session=123",
      "user-agent": "lightMyRequest",
      host: "localhost:80",
    },
    routeParams: {},
    source: "fastify",
    route: "/",
    cookies: {},
  });
});

t.test(
  "it adds context from request by using .default named import",
  async (t) => {
    const app = getApp("defaultNamed");

    const response = await app.inject({
      method: "GET",
      url: "/?title[$ne]=null",
      headers: {
        accept: "application/json",
        cookie: "session=123",
      },
    });

    t.same(response.statusCode, 200);

    const json = await response.json();
    t.same(json, {
      url: "/?title[$ne]=null",
      remoteAddress: "127.0.0.1",
      method: "GET",
      query: { "title[$ne]": "null" },
      headers: {
        accept: "application/json",
        cookie: "session=123",
        "user-agent": "lightMyRequest",
        host: "localhost:80",
      },
      routeParams: {},
      source: "fastify",
      route: "/",
      cookies: {},
    });
  }
);

t.test("it adds context from request for all", async (t) => {
  const app = getApp();

  const response = await app.inject({
    method: "POST",
    url: "/context",
    headers: {
      accept: "application/json",
      cookie: "session=123",
    },
  });

  t.same(response.statusCode, 200);

  const json = await response.json();
  t.same(json, {
    url: "/context",
    remoteAddress: "127.0.0.1",
    method: "POST",
    query: {},
    headers: {
      accept: "application/json",
      cookie: "session=123",
      "user-agent": "lightMyRequest",
      host: "localhost:80",
    },
    routeParams: {},
    source: "fastify",
    route: "/context",
    cookies: {},
  });
});

t.test("it adds body to context", async (t) => {
  const app = getApp();

  const response = await app.inject({
    method: "POST",
    url: "/context",
    headers: {
      accept: "application/json",
    },
    body: {
      title: "test",
    },
  });

  t.same(response.statusCode, 200);

  const json = await response.json();
  t.same(json, {
    url: "/context",
    remoteAddress: "127.0.0.1",
    method: "POST",
    query: {},
    headers: {
      accept: "application/json",
      "user-agent": "lightMyRequest",
      host: "localhost:80",
      "content-type": "application/json",
      "content-length": "16",
    },
    body: {
      title: "test",
    },
    routeParams: {},
    source: "fastify",
    route: "/context",
    cookies: {},
  });
});

t.test("it blocks request in on-request hook", async (t) => {
  const app = getApp();

  const response = await app.inject({
    method: "GET",
    url: "/on-request-attack?directory=/etc/",
    headers: {
      accept: "application/json",
    },
  });

  t.same(response.statusCode, 500);

  const json = response.json();
  t.match(
    json.message,
    /Aikido firewall has blocked a path traversal attack: fs.readdir.* originating from query.directory/
  );
});

t.test("it rate limits requests by ip address", async (t) => {
  const app = getApp();

  const response = await app.inject({
    method: "GET",
    url: "/rate-limited",
  });

  t.same(response.statusCode, 200);

  const response2 = await app.inject({
    method: "GET",
    url: "/rate-limited",
  });

  t.same(response2.statusCode, 429);
});

t.test(
  "it blocks blocked user",
  {
    skip:
      process.version.startsWith("v16") || process.version.startsWith("v18")
        ? "Fetch is not available"
        : false,
  },
  async (t) => {
    const app = getApp();
    await app.listen({ port: 4123 });
    await app.ready();

    const response = await fetch("http://127.0.0.1:4123/blocked-user");
    t.same(response.status, 403);

    app.close();
  }
);

t.test("does ignore invalid route usage", async (t) => {
  const app = getApp();

  try {
    // @ts-expect-error wrong usage
    app.route();
    t.notOk("should not reach here");
  } catch (error) {
    t.match(error.code, "FST_ERR_ROUTE_METHOD_INVALID");
  }

  try {
    // @ts-expect-error wrong usage
    app.route(null);
    t.notOk("should not reach here");
  } catch (error) {
    t.match(error.code, "FST_ERR_ROUTE_METHOD_INVALID");
  }
});

t.test("It works with route params", async (t) => {
  const app = getApp();

  app.get("/hello/:test", (request, reply) => {
    const context = getContext();
    reply.code(200).header("Content-Type", "application/json").send(context);
  });

  const response = await app.inject({
    method: "GET",
    url: "/hello/123",
    headers: {
      accept: "application/json",
    },
  });

  t.same(response.statusCode, 200);

  const json = await response.json();
  t.same(json, {
    url: "/hello/123",
    remoteAddress: "127.0.0.1",
    method: "GET",
    query: {},
    headers: {
      accept: "application/json",
      "user-agent": "lightMyRequest",
      host: "localhost:80",
    },
    routeParams: {
      test: "123",
    },
    source: "fastify",
    route: "/hello/:number",
    cookies: {},
  });
});
