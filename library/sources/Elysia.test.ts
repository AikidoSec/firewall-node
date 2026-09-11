import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { Elysia as ElysiaInternal } from "./Elysia";
import { HTTPServer } from "./HTTPServer";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { getContext } from "../agent/Context";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import { createTestAgent } from "../helpers/createTestAgent";
import { elysiaHandler } from "../middleware/elysia";
import { fetch } from "../helpers/fetch";
import { FetchListsAPIForTesting } from "../agent/api/FetchListsAPIForTesting";

const agent = createTestAgent({
  token: new Token("123"),
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
    excludedUserIdsFromRateLimiting: [],
  }),
  fetchListsAPI: new FetchListsAPIForTesting({
    blockedIPAddresses: [
      {
        key: "geoip/Belgium;BE",
        source: "geoip",
        description: "geo restrictions",
        ips: ["1.3.2.0/24"],
      },
    ],
    blockedUserAgents: "hacker|attacker",
    allowedIPAddresses: [],
    monitoredIPAddresses: [],
    monitoredUserAgents: "",
    userAgentDetails: [
      {
        key: "hacker",
        pattern: "hacker",
      },
    ],
  }),
});
agent.start([new ElysiaInternal(), new HTTPServer()]);

const skip =
  getMajorNodeVersion() < 20 ? "Elysia does not support Node.js < 20" : false;

const PORT = 9871;

let server: { stop(): void | Promise<void> };

t.before(async () => {
  if (skip) return;

  const { Elysia } = require("elysia") as typeof import("elysia");
  const { node } = require("@elysia/node") as typeof import("@elysia/node");

  const app = new Elysia({ adapter: node() });

  app.use((app) => {
    app.onBeforeHandle(({ request, path }: any) => {
      if (path.startsWith("/user/blocked")) {
        setUser({ id: "567" });
      } else if (path.startsWith("/user")) {
        setUser({ id: "123" });
      }

      const userId = request.headers.get("x-user-id");
      if (userId) {
        setUser({ id: userId });
      }
    });
    return app;
  });

  app.onBeforeHandle(elysiaHandler);

  app.onRequest((ctx) => {
    const path = new URL(ctx.request.url).pathname;
    if (path === "/test-on-request") {
      return getContext();
    }
  });

  app.on("beforeHandle", ({ request }) => {
    const path = new URL(request.url).pathname;
    if (path === "/test-on-before-handle") {
      return getContext();
    }
  });

  app.get("/", () => getContext());
  app.post("/json", () => getContext());
  app.post("/text", () => getContext());
  app.get("/user", () => getContext());
  app.get("/user/blocked", () => getContext());
  app.get("/rate-limited", () => "OK");
  app.get("/cats/:id", () => getContext());
  app.route("MKCALENDAR", "/calendars", () => getContext());

  app.get("/test-on-before-handle", (ctx) => "Not called");

  server = await new Promise<any>((resolve) => app.listen(PORT, resolve));
});

t.teardown(async () => {
  await server?.stop();
});

const opts = { skip };

t.test("it adds context from request for GET", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/?title=test`),
    method: "GET",
    headers: {
      accept: "application/json",
      cookie: "session=123",
    },
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    query: { title: "test" },
    cookies: { session: "123" },
    headers: { accept: "application/json", cookie: "session=123" },
    source: "elysia",
    route: "/",
  });

  t.ok(isLocalhostIP(body.remoteAddress));
});

t.test("it parses X-Forwarded-For header for IP address", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/?title=test`),
    method: "GET",
    headers: {
      "X-Forwarded-For": "1.2.3.4",
    },
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    query: { title: "test" },
    source: "elysia",
    route: "/",
    remoteAddress: "1.2.3.4",
  });
});

t.test("it adds JSON body to context", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/json`),
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ title: "test" }),
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "POST",
    body: { title: "test" },
    source: "elysia",
    route: "/json",
  });
});

t.test("it adds text body to context", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/text`),
    method: "POST",
    headers: {
      "content-type": "text/plain",
    },
    body: "hello world",
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "POST",
    body: "hello world",
    source: "elysia",
    route: "/text",
  });
});

t.test("it sets the user in the context", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/user`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/user",
    user: { id: "123" },
  });
});

t.test("it blocks user", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/user/blocked`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 403);
  t.equal(response.body, "You are blocked by Zen.");
});

t.test("it rate limits based on IP address", opts, async (t) => {
  const makeRequest = () =>
    fetch({
      url: new URL(`http://127.0.0.1:${PORT}/rate-limited`),
      method: "GET",
      headers: { "X-Forwarded-For": "1.2.3.4" },
      timeoutInMS: 500,
    });

  const r1 = await makeRequest();
  t.equal(r1.statusCode, 200);

  const r2 = await makeRequest();
  t.equal(r2.statusCode, 200);

  const r3 = await makeRequest();
  t.equal(r3.statusCode, 429);
  t.match(r3.body, "You are rate limited by Zen.");
});

t.test("ip blocking works", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/`),
    headers: {
      "X-Forwarded-For": "1.3.2.4", // Blocked IP
    },
  });
  t.equal(response.statusCode, 403);
  t.match(response.body, "geo restrictions");
});

t.test("it captures route parameters", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/cats/123`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/cats/:number",
    routeParams: { id: "123" },
  });
});

t.test("it works with custom request methods", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/calendars`),
    method: "MKCALENDAR",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "MKCALENDAR",
    source: "elysia",
    route: "/calendars",
  });
});

t.test("it works with on('request') handler", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/test-on-request`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/test-on-request",
  });
});

t.test("it returns 404 for non-existent route", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/test-on-request-does-not-exist`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 404);
});

t.test("it works with on('beforeHandle') handler", opts, async (t) => {
  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT}/test-on-before-handle`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/test-on-before-handle",
  });
});

t.test("app with prefix", opts, async (t) => {
  const { Elysia } = require("elysia") as typeof import("elysia");
  const { node } = require("@elysia/node") as typeof import("@elysia/node");

  const app = new Elysia({ adapter: node(), prefix: "/prefix" });

  app.get("/test", () => getContext());

  const _server = await new Promise<any>((resolve) =>
    app.listen(PORT + 1, resolve)
  );

  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT + 1}/prefix/test`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/prefix/test",
  });

  await _server?.stop();
});

t.test("app with only route", opts, async (t) => {
  const { Elysia } = require("elysia") as typeof import("elysia");
  const { node } = require("@elysia/node") as typeof import("@elysia/node");

  const app = new Elysia({ adapter: node(), prefix: "/prefix" });

  app.route("MKCALENDAR", "/test", () => getContext());

  const _server = await new Promise<any>((resolve) =>
    app.listen(PORT + 2, resolve)
  );

  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT + 2}/prefix/test`),
    method: "MKCALENDAR",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "MKCALENDAR",
    source: "elysia",
    route: "/prefix/test",
  });

  await _server?.stop();
});

t.test("app with only onRequest handler", opts, async (t) => {
  const { Elysia } = require("elysia") as typeof import("elysia");
  const { node } = require("@elysia/node") as typeof import("@elysia/node");

  const app = new Elysia({ adapter: node(), prefix: "/prefix" });

  app.onRequest((ctx) => {
    const path = new URL(ctx.request.url).pathname;
    if (path === "/prefix/test") {
      return getContext();
    }
  });

  const _server = await new Promise<any>((resolve) =>
    app.listen(PORT + 3, resolve)
  );

  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT + 3}/prefix/test`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/prefix/test",
  });

  await _server?.stop();
});

t.test("it supports groups", opts, async (t) => {
  const { Elysia } = require("elysia") as typeof import("elysia");
  const { node } = require("@elysia/node") as typeof import("@elysia/node");

  const app = new Elysia({ adapter: node() });

  app.group("/group", (group) => group.get("/test", () => getContext()));

  const _server = await new Promise<any>((resolve) =>
    app.listen(PORT + 4, resolve)
  );

  const response = await fetch({
    url: new URL(`http://127.0.01:${PORT + 4}/group/test?title=test`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/group/test",
    query: { title: "test" },
  });

  await _server?.stop();
});

t.test("it supports streams", opts, async (t) => {
  const { Elysia } = require("elysia") as typeof import("elysia");
  const { node } = require("@elysia/node") as typeof import("@elysia/node");

  const app = new Elysia({ adapter: node() });

  app.get("stream", function* test() {
    yield 1;
    yield 2;
    yield "\n";
    yield getContext();
  });

  const _server = await new Promise<any>((resolve) =>
    app.listen(PORT + 5, resolve)
  );

  const response = await fetch({
    url: new URL(`http://127.0.01:${PORT + 5}/stream`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body.split("\n").slice(-1)[0]);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/stream",
    query: {},
  });

  await _server?.stop();
});

t.test("it works with .on with multiple handlers", opts, async (t) => {
  const { Elysia } = require("elysia") as typeof import("elysia");
  const { node } = require("@elysia/node") as typeof import("@elysia/node");

  const app = new Elysia({ adapter: node() });

  app.on("request", [
    (ctx) => {
      const path = new URL(ctx.request.url).pathname;
      if (path === "/test-on-request") {
        return getContext();
      }
    },
    (ctx) => {
      const path = new URL(ctx.request.url).pathname;
      if (path === "/test-on-request-2") {
        return getContext();
      }
    },
  ]);

  const _server = await new Promise<any>((resolve) =>
    app.listen(PORT + 6, resolve)
  );

  const response = await fetch({
    url: new URL(`http://127.0.0.1:${PORT + 6}/test-on-request`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/test-on-request",
  });

  const response2 = await fetch({
    url: new URL(`http://127.0.0.1:${PORT + 6}/test-on-request-2`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response2.statusCode, 200);
  const body2 = JSON.parse(response2.body);
  t.match(body2, {
    method: "GET",
    source: "elysia",
    route: "/test-on-request-2",
  });

  await _server?.stop();
});

t.test("it works with app using another", opts, async (t) => {
  const { Elysia } = require("elysia") as typeof import("elysia");
  const { node } = require("@elysia/node") as typeof import("@elysia/node");

  const app1 = new Elysia({ adapter: node() }).get("/test", () => getContext());

  const app2 = new Elysia({ adapter: node() }).use(app1);

  const _server = await new Promise<any>((resolve) =>
    app2.listen(PORT + 7, resolve)
  );

  const response = await fetch({
    url: new URL(`http://127.0.01:${PORT + 7}/test`),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    source: "elysia",
    route: "/test",
    query: {},
  });

  await _server?.stop();
});
