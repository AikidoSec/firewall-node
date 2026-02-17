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
import { getContext } from "../agent/Context";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { addFastifyHook } from "../middleware/fastify";
import { FetchListsAPIForTesting } from "../agent/api/FetchListsAPIForTesting";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";

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
        route: "/rate-limited-2",
        forceProtectionOff: false,
        rateLimiting: {
          windowSizeInMS: 2000,
          maxRequests: 2,
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
  undefined,
  false,
  new FetchListsAPIForTesting()
);
agent.start([new Fastify(), new HTTPServer(), new FileSystem()]);
setInstance(agent);

async function getApp(
  importType: "default" | "fastify" | "defaultNamed" = "default",
  withoutHooks = false
) {
  let app: FastifyInstance;

  if (importType === "default") {
    if (isEsmUnitTest()) {
      app = require("fastify").default();
    } else {
      app = require("fastify")();
    }
  } else if (importType === "fastify") {
    const { fastify } = require("fastify");
    app = fastify();
  } else if (importType === "defaultNamed") {
    if (isEsmUnitTest()) {
      app = require("fastify").default.default();
    } else {
      app = require("fastify").default();
    }
  } else {
    throw new Error("Unknown import type");
  }

  if (!withoutHooks) {
    app.register(require("@fastify/cookie"));

    app.addHook("onRequest", async (request, reply) => {
      reply.header("X-Powered-By", "Aikido");

      if (request.url.startsWith("/blocked-user")) {
        setUser({ id: "567", name: "User" });
      }
    });

    addFastifyHook(app);

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

    app.addHook("onReady", function onReady(done) {
      done();
    });

    app.addHook("onError", (request, reply, error, done) => {
      done();
    });
  }

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

  app.get("/rate-limited-2", (request, reply) => {
    reply.code(200).send("ok");
  });

  app.addHttpMethod("MKCOL");

  app.mkcol("/testurl", async (request, reply) => {
    const context = getContext();
    reply.code(200).header("Content-Type", "application/json").send(context);
  });

  return app;
}

const opts = {
  skip:
    getMajorNodeVersion() < 18
      ? "Fastify does not support Node.js < 18"
      : false,
};

t.test("it adds context from request for all", opts, async (t) => {
  const app = await getApp();

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
  t.match(json, {
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
    cookies: {
      session: "123",
    },
    executedMiddleware: true,
  });

  // Url is absolute and includes query parameters
  t.match(json.url, /^http:\/\/.*\/\?title\[\$ne\]=null$/);
});

t.test(
  "it adds context from request by using default import",
  opts,
  async (t) => {
    const app = await getApp("default");

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
    t.match(json, {
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
      cookies: {
        session: "123",
      },
    });

    // Url is absolute and includes query parameters
    t.match(json.url, /^http:\/\/.*\/\?title\[\$ne\]=null$/);
  }
);

t.test(
  "it adds context from request by using .default named import",
  opts,
  async (t) => {
    const app = await getApp("defaultNamed");

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
    t.match(json, {
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
      cookies: {
        session: "123",
      },
    });

    // Url is absolute and includes query parameters
    t.match(json.url, /^http:\/\/.*\/\?title\[\$ne\]=null$/);
  }
);

t.test("it adds context from request for all", opts, async (t) => {
  const app = await getApp();

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
  t.match(json, {
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
    cookies: {
      session: "123",
    },
  });

  // Url is absolute
  t.match(json.url, /^http:\/\/.*\/context$/);
});

t.test("it adds body to context", opts, async (t) => {
  const app = await getApp();

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
  t.match(json, {
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

  // Url is absolute
  t.match(json.url, /^http:\/\/.*\/context$/);
});

t.test("it blocks request in on-request hook", opts, async (t) => {
  const app = await getApp();

  const response = await app.inject({
    method: "GET",
    url: "/on-request-attack?directory=/etc/passwd",
    headers: {
      accept: "application/json",
    },
  });

  t.same(response.statusCode, 500);

  const json = response.json();
  t.same(
    json.message,
    "Zen has blocked a path traversal attack: fs.readdir(...) originating from query.directory"
  );
});

t.test("it rate limits requests by ip address", opts, async (t) => {
  const app = await getApp();

  const response = await app.inject({
    method: "GET",
    url: "/rate-limited",
  });

  t.same(response.statusCode, 200);

  const response2 = await app.inject({
    method: "GET",
    url: "/rate-limited",
  });

  t.same(response2.statusCode, 200);

  const response3 = await app.inject({
    method: "GET",
    url: "/rate-limited",
  });

  t.same(response3.statusCode, 200);

  const response4 = await app.inject({
    method: "GET",
    url: "/rate-limited",
  });

  t.same(response4.statusCode, 429);
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
    const app = await getApp();
    await app.listen({ port: 4123 });
    await app.ready();

    const response = await fetch("http://127.0.0.1:4123/blocked-user");
    t.same(response.status, 403);

    app.close();
  }
);

t.test("does ignore invalid route usage", opts, async (t) => {
  const app = await getApp();

  try {
    // @ts-expect-error wrong usage
    app.route();
    t.notOk("should not reach here");
  } catch (error) {
    t.match(
      (error as NodeJS.ErrnoException).code,
      "FST_ERR_ROUTE_MISSING_HANDLER"
    );
  }

  try {
    // @ts-expect-error wrong usage
    app.route(null);
    t.notOk("should not reach here");
  } catch (error) {
    t.match(
      (error as NodeJS.ErrnoException).code,
      "FST_ERR_ROUTE_MISSING_HANDLER"
    );
  }
});

t.test("It works with route params", opts, async (t) => {
  const app = await getApp();

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
  t.match(json, {
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

  // Url is absolute
  t.match(json.url, /^http:\/\/.*\/hello\/123$/);
});

t.test(
  "it rate limits requests by ip address in app withouth hooks",
  opts,
  async (t) => {
    const app = await getApp("default", false);

    const response = await app.inject({
      method: "GET",
      url: "/rate-limited-2",
    });

    t.same(response.statusCode, 200);

    const response2 = await app.inject({
      method: "GET",
      url: "/rate-limited-2",
    });

    t.same(response2.statusCode, 200);

    const response3 = await app.inject({
      method: "GET",
      url: "/rate-limited-2",
    });

    t.same(response3.statusCode, 429);
  }
);

t.test("it works with addHttpMethod", opts, async (t) => {
  const app = await getApp();

  const response = (await app.inject({
    // @ts-expect-error not typed yet correctly after v5 release
    method: "MKCOL",
    url: "/testurl",
  })) as any;

  t.same(response.statusCode, 200);

  t.same(response.statusCode, 200);

  const json = await response.json();
  t.match(json, {
    remoteAddress: "127.0.0.1",
    method: "MKCOL",
    query: {},
    headers: {
      "user-agent": "lightMyRequest",
      host: "localhost:80",
    },
    routeParams: {},
    source: "fastify",
    route: "/testurl",
    cookies: {},
  });

  // Url is absolute
  t.match(json.url, /^http:\/\/.*\/testurl$/);
});

t.test("it adds context from request for all", opts, async (t) => {
  const app = await getApp();

  const response = await app.inject({
    method: "GET",
    url: "/?title[$ne]=null",
    headers: {
      accept: "application/json",
      cookie: "session=123",
      "X-Forwarded-Host": "example.com",
      "X-Forwarded-Proto": "http",
    },
  });

  t.same(response.statusCode, 200);

  const json = await response.json();
  t.match(json, {
    url: "http://example.com/?title[$ne]=null",
    urlPath: "/",
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
    cookies: {
      session: "123",
    },
    executedMiddleware: true,
  });
});
