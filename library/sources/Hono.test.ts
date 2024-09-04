import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Hono as HonoInternal } from "./Hono";
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
agent.start([new HonoInternal(), new HTTPServer()]);
setInstance(agent);

import { Hono } from "hono";
import { getContext } from "../agent/Context";

function getApp() {
  const app = new Hono();

  app.all("/", (c) => {
    return c.json(getContext());
  });

  app.use(async (c, next) => {
    if (c.req.path.startsWith("/user/blocked")) {
      setUser({ id: "567" });
    } else if (c.req.path.startsWith("/user")) {
      setUser({ id: "123" });
    }
    next();
  });

  app.on(["GET"], ["/user", "/user/blocked"], (c) => {
    return c.json(getContext());
  });

  app.get("/rate-limited", (c) => {
    return c.text("OK");
  });

  return app;
}

t.test("it adds context from request for GET", async (t) => {
  const response = await getApp().request("/?title=test", {
    method: "GET",
    headers: {
      accept: "application/json",
      cookie: "session=123",
    },
  });

  const body = await response.json();
  t.match(body, {
    method: "GET",
    query: { title: "test" },
    cookies: { session: "123" },
    headers: { accept: "application/json", cookie: "session=123" },
    source: "hono",
    route: "/",
  });
});

t.test("it adds JSON body to context", async (t) => {
  const response = await getApp().request("/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ title: "test" }),
  });

  const body = await response.json();
  t.match(body, {
    method: "POST",
    body: { title: "test" },
    source: "hono",
    route: "/",
  });
});

t.test("it adds form body to context", async (t) => {
  const response = await getApp().request("/", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "title=test",
  });

  const body = await response.json();
  t.match(body, {
    method: "POST",
    body: { title: "test" },
    source: "hono",
    route: "/",
  });
});

t.test("it adds text body to context", async (t) => {
  const response = await getApp().request("/", {
    method: "POST",
    headers: {
      "content-type": "text/plain",
    },
    body: "test",
  });

  const body = await response.json();
  t.match(body, {
    method: "POST",
    body: "test",
    source: "hono",
    route: "/",
  });
});

t.test("it adds xml body to context", async (t) => {
  const response = await getApp().request("/", {
    method: "POST",
    headers: {
      "content-type": "application/xml",
    },
    body: "<test>test</test>",
  });

  const body = await response.json();
  t.match(body, {
    method: "POST",
    body: "<test>test</test>",
    source: "hono",
    route: "/",
  });
});

t.test("it sets the user in the context", async (t) => {
  const response = await getApp().request("/user", {
    method: "GET",
  });

  const body = await response.json();
  t.match(body, {
    method: "GET",
    source: "hono",
    route: "/",
    user: { id: "123" },
  });
});

t.test("it blocks user", async (t) => {
  const response = await getApp().request("/user/blocked", {
    method: "GET",
  });

  const body = await response.text();
  t.equal(body, "You are blocked by Aikido firewall.");
});

t.test("it rate limits based on IP address", async (t) => {
  const response = await getApp().request("/rate-limited", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "1.2.3.4",
    },
  });
  t.match(response.status, 200);
  t.match(await response.text(), "OK");

  const response2 = await getApp().request("/rate-limited", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "1.2.3.4",
    },
  });
  t.match(response2.status, 200);
  t.match(await response2.text(), "OK");

  const response3 = await getApp().request("/rate-limited", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "1.2.3.4",
    },
  });
  t.match(response3.status, 429);
  t.match(
    await response3.text(),
    "ou are rate limited by Aikido firewall. (Your IP: 1.2.3.4)"
  );
});

t.test("it ignores invalid json body", async (t) => {
  const response = await getApp().request("/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "invalid",
  });

  const body = await response.json();
  t.match(body, {
    method: "POST",
    body: undefined,
    source: "hono",
    route: "/",
  });
});
