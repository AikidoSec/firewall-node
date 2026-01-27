import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { startTestAgent } from "../helpers/startTestAgent";
import { Express } from "./Express";
import { FileSystem } from "../sinks/FileSystem";
import { HTTPServer } from "./HTTPServer";
import { fetch } from "../helpers/fetch";
import type { Request, Response, NextFunction } from "express";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { getContext } from "../agent/Context";
import { setUser } from "../agent/context/user";
import { addExpressMiddleware } from "../middleware/express";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";

// Async needed because `require(...)` is translated to `await import(..)` when running tests in ESM mode
export async function createExpressTests(expressPackageName: string) {
  // Before require("express")
  const agent = startTestAgent({
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
    token: new Token("123"),
    wrappers: [new Express(), new FileSystem(), new HTTPServer()],
    rewrite: {
      express: expressPackageName,
    },
  });

  let express = require(expressPackageName) as typeof import("express");

  if (isEsmUnitTest()) {
    // @ts-expect-error Wrong types
    express = express.default;
  }

  const { readFile, readdir } = require("fs") as typeof import("fs");

  function getApp(userMiddleware = true) {
    const app = express();

    app.set("trust proxy", true);
    app.set("env", "test");
    app.use(cookieParser());

    app.use("/.*path", (req, res, next) => {
      res.setHeader("X-Powered-By", "Aikido");
      next();
    });

    if (userMiddleware) {
      app.use((req, res, next) => {
        if (req.path === "/block-user") {
          setUser({
            id: "567",
          });
          return next();
        }

        setUser({
          id: "123",
          name: "John Doe",
        });
        next();
      });
    }

    addExpressMiddleware(app);

    app.use("/middleware/:otherParamId", (req, res, next) => {
      res.setHeader("X-Context-Middleware", JSON.stringify(getContext()));
      next();
    });

    app.use("/attack-in-middleware", (req, res, next) => {
      readdir(req.query.directory as string, () => {});
      next();
    });

    function apiMiddleware(req: Request, res: Response, next: NextFunction) {
      const context = getContext();

      res.send(context);
    }

    // A middleware that is used as a route
    if (expressPackageName.endsWith("v4")) {
      app.use("/api/*", apiMiddleware);
    } else {
      app.use("/api/*path", apiMiddleware);
    }

    const newRouter = express.Router();
    newRouter.get("/nested-router", (req, res) => {
      res.send(getContext());
    });

    app.use(newRouter);

    app.use("/", express.static(__dirname + "/fixtures/public/"));

    const nestedApp = express();
    nestedApp.set("trust proxy", true);
    nestedApp.get("/", (req, res) => {
      res.send(getContext());
    });

    app.use("/nested-app", nestedApp);

    const nestedNestedApp = express();
    nestedNestedApp.get("/2", (req, res) => {
      res.send(getContext());
    });
    nestedApp.use(nestedNestedApp);

    nestedApp.get("/foo", (req, res) => {
      res.send("bar");
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
      readdir(req.query.directory as string, () => {});

      res.send(getContext());
    });

    app.get("/files-subdomains", (req, res) => {
      readdir(req.subdomains[2], () => {});

      res.send(getContext());
    });

    app.get("/attack-in-middleware", (req, res) => {
      res.send({ willNotBeSent: true });
    });

    app.get(
      "/middleware/:id",
      (req, res, next) => {
        res.setHeader(
          "X-Context-Route-Middleware",
          JSON.stringify(getContext())
        );
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

    app.get("/block-user", (req, res) => {
      res.send({
        willNotBeSent: true,
      });
    });

    app.get("/rate-limited", (req, res) => {
      res.send({ hello: "world" });
    });

    app.get("/user-rate-limited", (req, res) => {
      res.send({ hello: "world" });
    });

    app.param("file", (req, res, next, path) => {
      // Simulate a vulnerable parameter handler that uses fs operations
      readdir(path, next);
    });

    app.get("/param/:file", (req, res) => {
      res.send({ success: true });
    });

    if (expressPackageName.endsWith("v4")) {
      app.get("/white-listed-ip-address", (req, res, next) => {
        res.send({ hello: "world" });
      });

      app.use("/middleware-rate-limited", (req, res, next) => {
        res.send({ hello: "world" });
      });
    } else {
      app.route("/white-listed-ip-address").get((req, res) => {
        res.send({ hello: "world" });
      });

      app.router.use("/middleware-rate-limited", (req, res, next) => {
        res.send({ hello: "world" });
      });
    }

    app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
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

    // Url is absolute and includes query parameters
    t.match(response.body.url, /^http:\/\/.*\/\?title=test&x=5$/);
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
      .send({
        title: "Title",
        authors: ["Author"],
        settings: { theme: "Dark" },
      });

    t.same(response.statusCode, 200);
    t.same(agent.getRoutes().asArray(), [
      {
        method: "POST",
        path: "/",
        hits: 1,
        rateLimitedCount: 0,
        graphql: undefined,
        apispec: {
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
          query: undefined,
          auth: undefined,
        },
        graphQLSchema: undefined,
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
        aborted: 0,
        rateLimited: 0,
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
      /Zen has blocked a path traversal attack: fs.readdir(...)/
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

  t.test("it counts request with error", async (t) => {
    agent.getInspectionStatistics().reset();
    const response = await request(getApp()).get("/throws");
    t.same(response.statusCode, 500);
    t.same(response.body, { error: "test" });
    t.match(agent.getInspectionStatistics().getStats(), {
      requests: {
        total: 0, // Errors are not counted
        aborted: 0,
        rateLimited: 0,
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

    const middlewareContext = JSON.parse(
      response.header["x-context-middleware"]
    );
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
      /Zen has blocked a path traversal attack: fs.readdir(...)/
    );
  });

  t.test("detect attack in middleware", async () => {
    const response = await request(getApp())
      .get("/files-subdomains")
      .set("Host", "/etc/passwd.127.0.0.1");

    t.same(response.statusCode, 500);
    t.match(
      response.text,
      /Zen has blocked a path traversal attack: fs.readdir(...)/
    );
  });

  t.test("it detects attacks in app.param() handlers", async (t) => {
    const response = await request(getApp()).get(
      `/param/${encodeURIComponent("../../")}`
    );

    t.same(response.statusCode, 500);
    t.match(
      response.text,
      /Zen has blocked a path traversal attack: fs.readdir(...)/
    );
  });

  t.test("it blocks user", async () => {
    const response = await request(getApp()).get("/block-user");

    t.same(response.statusCode, 403);
    t.same(response.body, {});
    t.same(response.text, "You are blocked by Zen.");
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
    t.same(res2.text, "You are rate limited by Zen. (Your IP: 1.2.3.4)");

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

  t.test("it preserves original function name in Layer object", async () => {
    const app = getApp();

    /**
     * Ghost uses the name of the original function to look up the site router (a middleware)
     * Before the fix, the name of the middleware was changed to `<anonymous>` by Zen
     *
     * _getSiteRouter(req) {
     *     let siteRouter = null;
     *
     *     req.app._router.stack.every((router) => {
     *         if (router.name === 'SiteRouter') {
     *             siteRouter = router;
     *             return false;
     *         }
     *
     *         return true;
     *     });
     *
     *     return siteRouter;
     * }
     */

    let stack;
    if (expressPackageName.endsWith("v4")) {
      // On express v4, the router is available as `app._router`
      stack = app._router.stack;
    } else {
      // On express v5, the router is available as `app.router`
      stack = app.router.stack;
    }

    t.same(
      stack.filter((stack: { name: string }) => stack.name === "apiMiddleware")
        .length,
      1
    );
  });

  t.test("it supports nested router", async () => {
    const response = await request(getApp()).get("/nested-router");

    t.match(response.body, {
      method: "GET",
      source: "express",
      route: "/nested-router",
    });
  });

  t.test("it supports static files", async (t) => {
    const response = await request(getApp()).get("/test.txt");

    t.same(response.text, "Testfile");
  });

  t.test("it supports nested app", async (t) => {
    const response = await request(getApp()).get("/nested-app");

    t.match(response.body, {
      method: "GET",
      source: "express",
      route: "/nested-app",
    });

    const response2 = await request(getApp()).get("/nested-app/foo");
    t.same(response2.text, "bar");

    const response3 = await request(getApp()).get("/nested-app/2");
    t.match(response3.body, {
      method: "GET",
      source: "express",
      route: "/nested-app/:number",
    });
  });

  // Express instrumentation results in routes with no stack, crashing Ghost
  // https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2271
  // https://github.com/open-telemetry/opentelemetry-js-contrib/pull/2294
  t.test(
    "it keeps handle properties even if router is patched before instrumentation does it",
    async () => {
      const { createServer } = require("http") as typeof import("http");
      const expressApp = express();
      const router = express.Router();

      let routerLayer: { name: string; handle: { stack: any[] } } | undefined =
        undefined;

      const CustomRouter: (...p: Parameters<typeof router>) => void = (
        req,
        res,
        next
      ) => router(req, res, next);

      router.use("/:slug", (req, res, next) => {
        let stack;
        if (expressPackageName.endsWith("v4")) {
          // On express v4, the router is available as `app._router`
          stack = req.app._router.stack as any[];
        } else {
          // On express v5, the router is available as `app.router`
          stack = req.app.router.stack as any[];
        }
        routerLayer = stack.find((router) => router.name === "CustomRouter");
        res.status(200).send("bar");
      });

      // The patched router now has express router's own properties in its prototype so
      // they are not accessible through `Object.keys(...)`
      // https://github.com/TryGhost/Ghost/blob/fefb9ec395df8695d06442b6ecd3130dae374d94/ghost/core/core/frontend/web/site.js#L192
      Object.setPrototypeOf(CustomRouter, router);
      expressApp.use(CustomRouter);

      // supertest acts weird with the custom router, so we need to create a server manually
      const server = createServer(expressApp);
      await new Promise<void>((resolve) => {
        server.listen(0, resolve);
      });

      if (!server) {
        throw new Error("server not found");
      }

      const address = server.address();

      if (typeof address === "string") {
        throw new Error("address is a string");
      }

      const response = await fetch({
        url: new URL(`http://localhost:${address!.port}/foo`),
      });
      t.same(response.body, "bar");
      server.close();

      if (!routerLayer) {
        throw new Error("router layer not found");
      }

      t.ok(
        // @ts-expect-error handle is private
        routerLayer.handle.stack.length === 1,
        "router layer stack is accessible"
      );
    }
  );

  t.test("it supports adding middleware to a Router instance", async (t) => {
    const app = express();
    const router = express.Router();

    router.use((req, res, next) => {
      setUser({ id: "567" });
      next();
    });

    // Add Zen middleware to router instead of app
    addExpressMiddleware(router);

    router.get("/router-block-user", (req, res) => {
      res.send({ willNotBeSent: true });
    });

    app.use(router);

    const blockedResponse = await request(app).get("/router-block-user");
    t.same(blockedResponse.statusCode, 403);
    t.same(blockedResponse.text, "You are blocked by Zen.");
  });

  t.test("it detects path traversal with double encoding", async (t) => {
    const app = express();

    app.get("/search", (req, res) => {
      const searchTerm = req.query.q as string;
      const fileUrl = new URL(`file:///public/${searchTerm}`);

      readFile(fileUrl, "utf-8", (err, data) => {
        if (err) {
          return res.status(500).send("Error reading file");
        }
        res.send(`File content of /public/${searchTerm} : ${data}`);
      });
    });

    const blockedResponse = await request(app).get(
      "/search?q=.%252E/etc/passwd"
    );
    t.same(blockedResponse.statusCode, 500);
    t.match(
      blockedResponse.text,
      /Error: Zen has blocked a path traversal attack: fs.readFile\(\.\.\.\) originating from query/
    );
  });

  t.test("it counts rate limited requests", async (t) => {
    agent.getRoutes().clear();
    agent.getInspectionStatistics().reset();

    const resp1 = await request(getApp(false))
      .get("/rate-limited")
      .set("x-forwarded-for", "123.123.123.123");
    t.same(resp1.statusCode, 200);

    const resp2 = await request(getApp(false))
      .get("/rate-limited")
      .set("x-forwarded-for", "123.123.123.123");
    t.same(resp2.statusCode, 200);

    const resp3 = await request(getApp(false))
      .get("/rate-limited")
      .set("x-forwarded-for", "123.123.123.123");
    t.same(resp3.statusCode, 200);

    const resp4 = await request(getApp(false))
      .get("/rate-limited")
      .set("x-forwarded-for", "123.123.123.123");
    t.same(resp4.statusCode, 429);

    t.same(agent.getRoutes().asArray(), [
      {
        method: "GET",
        path: "/rate-limited",
        hits: 3, // Only the first 3 requests are counted as hits
        rateLimitedCount: 1,
        graphql: undefined,
        apispec: {},
        graphQLSchema: undefined,
      },
    ]);
    t.match(agent.getInspectionStatistics().getStats(), {
      requests: {
        total: 4,
        aborted: 0,
        rateLimited: 1,
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
      },
    });
  });

  t.test(
    "it respects host forwarded header for url construction",
    async (t) => {
      const app = getApp();
      app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

      const response = await request(app)
        .get("/?title=test&x=5")
        .set("Cookie", "session=123")
        .set("Accept", "application/json")
        .set("X-Forwarded-Host", "example.com")
        .set("X-Forwarded-Proto", "https")
        .set("X-Forwarded-For", "1.2.3.4");

      t.match(response.body, {
        url: "https://example.com/?title=test&x=5",
        method: "GET",
        query: { title: "test", x: "5" },
        cookies: { session: "123" },
        headers: { accept: "application/json", cookie: "session=123" },
        remoteAddress: "1.2.3.4",
        source: "express",
        route: "/",
      });
    }
  );
}
