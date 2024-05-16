import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { setUser } from "../agent/context/user";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Express } from "./Express";
import { FileSystem } from "../sinks/FileSystem";
import { HTTPServer } from "./HTTPServer";

// Before require("express")
const agent = new Agent(
  true,
  new LoggerNoop(),
  new ReportingAPIForTesting(),
  undefined,
  "lambda"
);
agent.start([new Express(), new FileSystem(), new HTTPServer()]);

import * as express from "express";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { getContext } from "../agent/Context";

function getApp() {
  const app = express();

  app.set("trust proxy", true);
  app.set("env", "test");
  app.use(cookieParser());

  app.use("/*", (req, res, next) => {
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

  app.use((req, res, next) => {
    setUser({
      id: "123",
      name: "John Doe",
    });
    next();
  });

  // A middleware that is used as a route
  app.use("/api/*", (req, res, next) => {
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

  return app;
}

t.test("it adds context from request for GET", async (t) => {
  const response = await request(getApp())
    .get("/?title[$ne]=null")
    .set("Cookie", "session=123")
    .set("Accept", "application/json")
    .set("X-Forwarded-For", "1.2.3.4");

  t.match(response.body, {
    method: "GET",
    query: { title: { $ne: "null" } },
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

t.test("it adds context from request for route", async (t) => {
  const response = await request(getApp()).get("/route");

  t.match(response.body, {
    method: "GET",
    query: {},
    cookies: {},
    headers: {},
    source: "express",
    route: "/route",
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
    /Aikido runtime has blocked a Path traversal: fs.readdir(...)/
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
  await request(getApp()).get("/throws");
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
    route: "/posts/:id",
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
    route: "/.*fly$",
  });
});

t.test("it takes the path from the arguments for middleware", async () => {
  const response = await request(getApp()).get("/api/foo");

  t.match(response.body, { route: "/api/*" });
});

t.test("route handler with middleware", async () => {
  const response = await request(getApp()).get("/middleware/123");

  const middlewareContext = JSON.parse(response.header["x-context-middleware"]);
  t.match(middlewareContext, { route: "/middleware/:otherParamId" });
  t.match(middlewareContext.routeParams, { otherParamId: "123" });

  const routeMiddlewareContext = JSON.parse(
    response.header["x-context-route-middleware"]
  );
  t.match(routeMiddlewareContext, { route: "/middleware/:id" });
  t.match(response.body, { route: "/middleware/:id" });
});

t.test("detect attack in middleware", async () => {
  const response = await request(getApp()).get(
    "/attack-in-middleware?directory=../../"
  );

  t.same(response.statusCode, 500);
  t.match(
    response.text,
    /Aikido runtime has blocked a Path traversal: fs.readdir(...)/
  );
});

t.test("it adds user to context", async () => {
  const response = await request(getApp()).get("/user");

  t.match(response.body, {
    user: { id: "123", name: "John Doe" },
  });
});
