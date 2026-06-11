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
import { addElysiaPlugin } from "../middleware/elysia";
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
  getMajorNodeVersion() < 18 ? "Elysia does not support Node.js < 18" : false;

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

  addElysiaPlugin(app);

  app.get("/", () => getContext());
  app.post("/json", () => getContext());
  app.post("/text", () => getContext());
  app.get("/user", () => getContext());
  app.get("/user/blocked", () => getContext());
  app.get("/rate-limited", () => "OK");
  app.get("/cats/:id", () => getContext());

  server = await new Promise<any>((resolve) => app.listen(PORT, resolve));
});

t.after(async () => {
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
