import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { addRestifyMiddleware } from "../middleware/restify";
import { Restify } from "./Restify";
import { HTTPServer } from "./HTTPServer";
import { FileSystem } from "../sinks/FileSystem";
import * as request from "supertest";
import { getContext } from "../agent/Context";
import { startTestAgent } from "../helpers/startTestAgent";

// Async needed because `require(...)` is translated to `await import(..)` when running tests in ESM mode
export async function createRestifyTests(restifyPackageName: string) {
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
    token: new Token("123"),
    serverless: undefined,
    wrappers: [new Restify(), new HTTPServer(), new FileSystem()],
    rewrite: {
      restify: restifyPackageName,
    },
  });

  const restify = require(restifyPackageName);
  const { readFile } = require("fs") as typeof import("fs");

  async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getApp() {
    const server = restify.createServer({
      name: "test-server",
      version: "1.0.0",
    });

    // Basic middleware
    server.use(restify.plugins.queryParser());
    server.use(restify.plugins.bodyParser());
    server.use((req: any, res: any, next: any) => {
      if (req.headers["x-zen-user"]) {
        setUser({ id: req.headers["x-zen-user"] });
      }

      return next();
    });
    addRestifyMiddleware(server);

    // Test routes
    server.get("/", (req: any, res: any, next: any) => {
      res.send({ context: getContext() });
      return next();
    });

    server.get("/posts/:id", (req: any, res: any, next: any) => {
      res.send({ context: getContext() });
      return next();
    });

    server.post("/posts", (req: any, res: any, next: any) => {
      res.send({ context: getContext() });
      return next();
    });

    server.get("/rate-limited", (req: any, res: any, next: any) => {
      res.send({ hello: "world" });
      return next();
    });

    server.get("/files", (req: any, res: any, next: any) => {
      if (req.query.directory) {
        try {
          readFile(req.query.directory + "/file.txt", "utf8", (err, data) => {
            if (err) {
              return next(err);
            }

            res.send({ data });
            return next();
          });
        } catch (err) {
          return next(err);
        }
      } else {
        res.send({ files: [] });
        return next();
      }
    });

    return server;
  }

  t.test("it adds context", async (t) => {
    const response = await request(getApp()).get("/");

    t.match(response.body.context, {
      method: "GET",
      query: {},
      headers: {},
      source: "restify",
      route: "/",
    });

    t.match(response.body.context.url, /^http:\/\/.*\/$/);
  });

  t.test("it adds context from request for route with params", async (t) => {
    const response = await request(getApp()).get("/posts/123");

    t.match(response.body.context, {
      method: "GET",
      routeParams: { id: "123" },
      source: "restify",
      route: "/posts/:number",
    });
  });

  t.test("it adds context from request body", async (t) => {
    const response = await request(getApp())
      .post("/posts")
      .send({ title: "Hello World" });

    t.match(response.body.context, {
      method: "POST",
      body: { title: "Hello World" },
      source: "restify",
      route: "/posts",
    });
  });

  t.test("it counts requests", async () => {
    agent.getInspectionStatistics().reset();
    await request(getApp()).get("/");
    await request(getApp()).post("/posts").send({});
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
      /Zen has blocked a path traversal attack: fs.readfile\(\.\.\.\)/i
    );
    t.same(response.statusCode, 500);
    t.match(agent.getInspectionStatistics().getStats(), {
      requests: {
        total: 0,
        attacksDetected: {
          total: 1,
          blocked: 1,
        },
      },
    });
  });

  t.test("user blocking works using middleware", async (t) => {
    agent.getInspectionStatistics().reset();
    const response = await request(getApp())
      .get("/posts/123")
      .set("x-zen-user", "567");

    t.same(response.statusCode, 403);
  });

  t.test("it rate limits by IP", async () => {
    for (const _ of Array.from({ length: 3 })) {
      const res = await request(getApp())
        .get("/rate-limited")
        .set("x-forwarded-for", "1.2.3.4");
      t.same(res.statusCode, 200);
    }

    const res2 = await request(getApp())
      .get("/rate-limited")
      .set("x-forwarded-for", "1.2.3.4");
    t.same(res2.statusCode, 429);
    t.same(res2.text, "You are rate limited by Zen. (Your IP: 1.2.3.4)");

    await sleep(2000);

    const res3 = await request(getApp())
      .get("/rate-limited")
      .set("x-forwarded-for", "1.2.3.4");
    t.same(res3.statusCode, 200);
  });

  t.test("it respects forwarded host header", async (t) => {
    const response = await request(getApp())
      .get("/")
      .set("x-forwarded-host", "example.com");

    t.match(response.body.context, {
      url: "http://example.com/",
      urlPath: "/",
      method: "GET",
      query: {},
      headers: {
        "x-forwarded-host": "example.com",
      },
      source: "restify",
      route: "/",
    });
  });
}
