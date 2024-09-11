import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Express } from "./Express";
import { FileSystem } from "../sinks/FileSystem";
import { HTTPServer } from "./HTTPServer";

// Before require("express")
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
        route: "/middleware-rate-limited",
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
  "lambda"
);
agent.start([new Express(), new FileSystem(), new HTTPServer()]);
setInstance(agent);

import * as express from "express";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { getContext } from "../agent/Context";

function getApp(userMiddleware = true) {
  const app = express();

  app.set("trust proxy", true);
  app.set("env", "test");
  app.use(cookieParser());

  app.use("/.*path", (req, res, next) => {
    res.setHeader("X-Powered-By", "Aikido");
    next();
  });

  app.use("/middleware/:otherParamId", (req, res, next) => {
    res.setHeader("X-Context-Middleware", JSON.stringify(getContext()));
    next();
  });

  app.use("/attack-in-middleware", (req, res, next) => {
    require("fs").readdir(req.query.directory).unref();
    next();
  });

  if (userMiddleware) {
    app.use((req, res, next) => {
      setUser({
        id: "123",
        name: "John Doe",
      });
      next();
    });
  }

  // A middleware that is used as a route
  app.use("/api/*path", (req, res, next) => {
    const context = getContext();

    res.send(context);
  });

  app.get("/", (req, res) => {
    const context = getContext();

    res.send(context);
  });

  app.post("/", express.json(), (req, res) => {
    const context = getContext();

    res.send(context);
  });

  app.route("/route").get((req, res) => {
    const context = getContext();

    res.send(context);
  });

  app.all("/all", (req, res) => {
    const context = getContext();

    res.send(context);
  });

  app.get("/files", (req, res) => {
    require("fs").readdir(req.query.directory).unref();

    res.send(getContext());
  });

  app.get("/files-subdomains", (req, res) => {
    require("fs").readdir(req.subdomains[2]).unref();

    res.send(getContext());
  });

  app.get("/attack-in-middleware", (req, res) => {
    res.send({ willNotBeSent: true });
  });

  app.get(
    "/middleware/:id",
    (req, res, next) => {
      res.setHeader("X-Context-Route-Middleware", JSON.stringify(getContext()));
      next();
    },
    (req, res) => {
      res.send(getContext());
    }
  );

  app.get("/posts/:id", (req, res) => {
    const context = getContext();

    res.send(context);
  });

  app.get("/throws", (req, res) => {
    throw new Error("test");
  });

  app.get(/.*fly$/, (req, res) => {
    const context = getContext();

    res.send(context);
  });

  app.get("/user", (req, res) => {
    res.send(getContext());
  });

  app.get(
    "/block-user",
    (req, res, next) => {
      setUser({
        id: "567",
      });
      next();
    },
    (req, res) => {
      res.send({
        willNotBeSent: true,
      });
    }
  );

  app.get("/rate-limited", (req, res) => {
    res.send({ hello: "world" });
  });

  app.get("/user-rate-limited", (req, res) => {
    res.send({ hello: "world" });
  });

  app.route("/white-listed-ip-address").get((req, res) => {
    res.send({ hello: "world" });
  });

  // @ts-expect-error Not types for express 5 available yet
  app.router.use("/middleware-rate-limited", (req, res, next) => {
    res.send({ hello: "world" });
  });

  app.use((error, req, res, next) => {
    res.status(500).send({ error: error.message });
  });

  return app;
}

t.test("it adds context from request for GET", async (t) => {
  const response = await request(getApp())
    .get("/?title=test&x=5")
    .set("Cookie", "session=123")
    .set("Accept", "application/json")
    .set("X-Forwarded-For", "1.2.3.4");

  t.match(response.body, {
    method: "GET",
    query: { title: "test", x: "5" },
    cookies: { session: "123" },
    headers: { accept: "application/json", cookie: "session=123" },
    remoteAddress: "1.2.3.4",
    source: "express",
    route: "/",
  });
});

t.test("it adds context from request for POST", async (t) => {
  const response = await request(getApp()).post("/").send({ title: "Title" });

  t.match(response.body, {
    method: "POST",
    body: { title: "Title" },
    source: "express",
    route: "/",
  });
});

t.test("it adds body schema to stored routes", async (t) => {
  agent.getRoutes().clear();
  const response = await request(getApp())
    .post("/")
    .send({ title: "Title", authors: ["Author"], settings: { theme: "Dark" } });

  t.same(response.statusCode, 200);
  t.same(agent.getRoutes().asArray(), [
    {
      method: "POST",
      path: "/",
      hits: 1,
      graphql: undefined,
      body: {
        type: "json",
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            authors: { type: "array", items: { type: "string" } },
            settings: {
              type: "object",
              properties: {
                theme: { type: "string" },
              },
            },
          },
        },
      },
    },
  ]);
});

t.test("it adds context from request for route", async (t) => {
  const response = await request(getApp()).get("/route");

  t.match(response.body, {
    method: "GET",
    query: {},
    cookies: {},
    headers: {},
    source: "express",
    route: "/route",
    subdomains: [],
  });
});

t.test("it adds context from request for all", async (t) => {
  const response = await request(getApp()).get("/all");

  t.match(response.body, {
    method: "GET",
    query: {},
    cookies: {},
    headers: {},
    source: "express",
    route: "/all",
  });
});

t.test("it counts requests", async () => {
  agent.getInspectionStatistics().reset();
  await request(getApp()).get("/");
  await request(getApp()).post("/");
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

t.test("it counts attacks detected", async (t) => {
  agent.getInspectionStatistics().reset();
  const response = await request(getApp()).get("/files?directory=../../");

  t.match(
    response.text,
    /Aikido firewall has blocked a path traversal attack: fs.readdir(...)/
  );
  t.same(response.statusCode, 500);
  t.match(agent.getInspectionStatistics().getStats(), {
    requests: {
      total: 1,
      attacksDetected: {
        total: 1,
        blocked: 1,
      },
    },
  });
});

t.test("it counts request with error", async (t) => {
  agent.getInspectionStatistics().reset();
  const response = await request(getApp()).get("/throws");
  t.same(response.statusCode, 500);
  t.same(response.body, { error: "test" });
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

t.test("it adds context from request for route with params", async (t) => {
  const response = await request(getApp()).get("/posts/123");

  t.match(response.body, {
    method: "GET",
    routeParams: { id: "123" },
    source: "express",
    route: "/posts/:number",
  });
});

t.test("it deals with regex routes", async (t) => {
  const response = await request(getApp()).get("/butterfly");

  t.match(response.body, {
    method: "GET",
    query: {},
    cookies: {},
    headers: {},
    source: "express",
    route: "/butterfly",
  });
});

t.test("it takes the path from the arguments for middleware", async () => {
  const response = await request(getApp()).get("/api/foo");

  t.match(response.body, { route: "/api/foo" });
});

t.test("route handler with middleware", async () => {
  const response = await request(getApp()).get("/middleware/123");

  const middlewareContext = JSON.parse(response.header["x-context-middleware"]);
  t.match(middlewareContext, { route: "/middleware/:number" });
  t.match(middlewareContext.routeParams, { otherParamId: "123" });

  const routeMiddlewareContext = JSON.parse(
    response.header["x-context-route-middleware"]
  );
  t.match(routeMiddlewareContext, { route: "/middleware/:number" });
  t.match(response.body, { route: "/middleware/:number" });
});

t.test("detect attack in middleware", async () => {
  const response = await request(getApp()).get(
    "/attack-in-middleware?directory=../../"
  );

  t.same(response.statusCode, 500);
  t.match(
    response.text,
    /Aikido firewall has blocked a path traversal attack: fs.readdir(...)/
  );
});

t.test("detect attack in middleware", async () => {
  const response = await request(getApp())
    .get("/files-subdomains")
    .set("Host", "/etc/passwd.127.0.0.1");

  t.same(response.statusCode, 500);
  t.match(
    response.text,
    /Aikido firewall has blocked a path traversal attack: fs.readdir(...)/
  );
});

t.test("it blocks user", async () => {
  const response = await request(getApp()).get("/block-user");

  t.same(response.statusCode, 403);
  t.same(response.body, {});
});

t.test("it adds user to context", async () => {
  const response = await request(getApp()).get("/user");

  t.match(response.body, {
    user: { id: "123", name: "John Doe" },
  });
});

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

t.test("it rate limits by IP", async () => {
  for (const _ of Array.from({ length: 3 })) {
    const res = await request(getApp(false))
      .get("/rate-limited")
      .set("x-forwarded-for", "1.2.3.4");
    t.same(res.statusCode, 200);
  }

  const res2 = await request(getApp(false))
    .get("/rate-limited")
    .set("x-forwarded-for", "1.2.3.4");
  t.same(res2.statusCode, 429);
  t.same(
    res2.text,
    "You are rate limited by Aikido firewall. (Your IP: 1.2.3.4)"
  );

  await sleep(2000);

  const res3 = await request(getApp(false))
    .get("/rate-limited")
    .set("x-forwarded-for", "1.2.3.4");
  t.same(res3.statusCode, 200);
});

t.test("it rate limits by user", async () => {
  for (const _ of Array.from({ length: 3 })) {
    const res = await request(getApp()).get("/user-rate-limited");
    t.same(res.statusCode, 200);
  }

  const res = await request(getApp()).get("/user-rate-limited");
  t.same(res.statusCode, 429);

  await sleep(2000);

  const res2 = await request(getApp()).get("/user-rate-limited");
  t.same(res2.statusCode, 200);
});

t.test("it rate limits by middleware", async () => {
  for (const _ of Array.from({ length: 3 })) {
    const res = await request(getApp()).get("/middleware-rate-limited");
    t.same(res.statusCode, 200);
  }

  const res = await request(getApp()).get("/middleware-rate-limited");
  t.same(res.statusCode, 429);

  await sleep(2000);

  const res2 = await request(getApp()).get("/middleware-rate-limited");
  t.same(res2.statusCode, 200);
});

t.test("it allows white-listed IP address", async () => {
  for (const _ of Array.from({ length: 5 })) {
    const res = await request(getApp(false))
      .get("/white-listed-ip-address")
      .set("x-forwarded-for", "4.3.2.1");
    t.same(res.statusCode, 200);
  }
});
