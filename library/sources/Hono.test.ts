import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { Hono as HonoInternal } from "./Hono";
import { HTTPServer } from "./HTTPServer";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { getContext } from "../agent/Context";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import { createTestAgent } from "../helpers/createTestAgent";
import { addHonoMiddleware } from "../middleware/hono";
import * as fetch from "../helpers/fetch";
import { setRateLimitGroup } from "../ratelimiting/group";
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
      {
        method: "GET",
        route: "/rate-limited-group",
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
    allowedIPAddresses: ["4.3.2.1", "123.1.2.0/24"],
  }),
  fetchListsAPI: new FetchListsAPIForTesting({
    blockedIPAddresses: [
      {
        key: "geoip/Belgium;BE",
        source: "geoip",
        description: "geo restrictions",
        ips: ["1.3.2.0/24", "e98c:a7ba:2329:8c69::/64"],
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
      {
        key: "attacker",
        pattern: "attacker",
      },
    ],
  }),
});
agent.start([new HonoInternal(), new HTTPServer()]);

type Env = {
  Variables: {
    testProp: string;
  };
};

async function getApp() {
  const { Hono } = require("hono") as typeof import("hono");
  const { contextStorage: honoContextStorage, getContext: getHonoContext } =
    require("hono/context-storage") as typeof import("hono/context-storage");

  const app = new Hono<Env>();

  app.use(honoContextStorage());

  app.use(async (c, next) => {
    c.set("testProp", "test-value");
    if (c.req.path.startsWith("/user/blocked")) {
      setUser({ id: "567" });
    } else if (c.req.path.startsWith("/user")) {
      setUser({ id: "123" });
    } else if (c.req.path.startsWith("/rate-limited-group")) {
      const rateLimitGroup = c.req.header("X-Rate-Limit-Group") || "default";
      setRateLimitGroup({ id: rateLimitGroup });
    }
    await next();
  });

  addHonoMiddleware(app);

  app.all("/", (c) => {
    return c.json(getContext());
  });

  app.post("/json", async (c) => {
    try {
      const json = await c.req.json();
    } catch (e) {
      if (e instanceof SyntaxError) {
        return c.text("Invalid JSON", 400);
      }
      throw e;
    }
    return c.json(getContext());
  });

  app.post("/text", async (c) => {
    const text = await c.req.text();
    return c.json(getContext());
  });

  app.post("/form", async (c) => {
    const form = await c.req.parseBody();
    return c.json(getContext());
  });

  app.on(["GET"], ["/user", "/user/blocked"], (c) => {
    return c.json(getContext());
  });

  app.get("/rate-limited", (c) => {
    return c.text("OK");
  });

  app.get("/rate-limited-group", (c) => {
    return c.text("OK");
  });

  // Access async context outside of handler
  const getTestProp = () => {
    return getHonoContext<Env>().var.testProp;
  };

  app.get("/hono-async-context", (c) => {
    return c.text(getTestProp());
  });

  return app;
}

const opts = {
  skip:
    getMajorNodeVersion() < 18 ? "Hono does not support Node.js < 18" : false,
};

t.test("it adds context from request for GET", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/?title=test", {
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

  t.match(body.url, /^http:\/\/.*\/\?title=test$/);
});

t.test("it adds JSON body to context", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/json", {
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
    route: "/json",
  });
});

t.test("it adds form body to context", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/form", {
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
    route: "/form",
  });
});

t.test("it adds text body to context", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/text", {
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
    route: "/text",
  });
});

t.test("it adds xml body to context", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/text", {
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
    route: "/text",
  });
});

t.test("it sets the user in the context", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/user", {
    method: "GET",
  });

  const body = await response.json();
  t.match(body, {
    method: "GET",
    source: "hono",
    route: "/user",
    urlPath: "/user",
    user: { id: "123" },
    consumedRateLimit: true,
    executedMiddleware: true,
    cookies: {},
    url: "http://localhost/user",
  });
});

t.test("it blocks user", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/user/blocked", {
    method: "GET",
  });

  const body = await response.text();
  t.equal(body, "You are blocked by Zen.");
});

t.test("it rate limits based on IP address", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/rate-limited", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "1.2.3.4",
    },
  });
  t.match(response.status, 200);
  t.match(await response.text(), "OK");

  const response2 = await app.request("/rate-limited", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "1.2.3.4",
    },
  });
  t.match(response2.status, 200);
  t.match(await response2.text(), "OK");

  const response3 = await app.request("/rate-limited", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "1.2.3.4",
    },
  });
  t.match(response3.status, 429);
  t.match(
    await response3.text(),
    "You are rate limited by Zen. (Your IP: 1.2.3.4)"
  );

  const response4 = await app.request("/%72ate-limited", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "1.2.3.4",
    },
  });
  t.match(response4.status, 429);

  const response5 = await app.request("/%2572ate-limited", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "1.2.3.4",
    },
  });
  t.match(response5.status, 404);
});

t.test("it ignores invalid json body", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "invalid",
  });

  const body = await response.json();
  t.match(body, {
    method: "POST",
    source: "hono",
    route: "/",
  });
});

t.test("works using @hono/node-server (real socket ip)", opts, async (t) => {
  const { serve } =
    require("@hono/node-server") as typeof import("@hono/node-server");
  const server = serve({
    fetch: (await getApp()).fetch,
    port: 8765,
  });
  const response = await fetch.fetch({
    url: new URL("http://127.0.0.1:8765/?abc=test"),
    method: "GET",
    headers: {},
    timeoutInMS: 500,
  });
  t.same(response.statusCode, 200);
  const body = JSON.parse(response.body);
  t.match(body, {
    method: "GET",
    query: { abc: "test" },
    source: "hono",
    route: "/",
    urlPath: "/",
  });
  t.ok(isLocalhostIP(body.remoteAddress));
  server.close();
});

t.test("ip and bot blocking works (real socket)", opts, async (t) => {
  // Start a server with a real socket
  // The blocking is implemented in the HTTPServer source
  const { serve } =
    require("@hono/node-server") as typeof import("@hono/node-server");
  const server = serve({
    fetch: (await getApp()).fetch,
    port: 8766,
  });

  // Test blocked IP (IPv4)
  const response = await fetch.fetch({
    url: new URL("http://127.0.0.1:8766/"),
    headers: {
      "X-Forwarded-For": "1.3.2.4", // Blocked IP
    },
  });
  t.equal(response.statusCode, 403);
  t.equal(
    response.body,
    "Your IP address is blocked due to geo restrictions. (Your IP: 1.3.2.4)"
  );

  // Test blocked IP (IPv6)
  const response2 = await fetch.fetch({
    url: new URL("http://127.0.0.1:8766/"),
    headers: {
      "X-Forwarded-For": "e98c:a7ba:2329:8c69:a13a:8aff:a932:13f2", // Blocked IP
    },
  });
  t.equal(response2.statusCode, 403);
  t.equal(
    response2.body,
    "Your IP address is blocked due to geo restrictions. (Your IP: e98c:a7ba:2329:8c69:a13a:8aff:a932:13f2)"
  );

  // Test allowed IP
  const response3 = await fetch.fetch({
    url: new URL("http://127.0.0.1:8766/"),
    headers: {
      "X-Forwarded-For": "9.8.7.6", // Allowed IP
    },
  });
  t.equal(response3.statusCode, 200);

  // Test blocked user agent
  const response4 = await fetch.fetch({
    url: new URL("http://127.0.0.1:8766/"),
    headers: {
      "User-Agent": "hacker",
    },
  });
  t.equal(response4.statusCode, 403);
  t.equal(
    response4.body,
    "You are not allowed to access this resource because you have been identified as a bot."
  );

  // Cleanup server
  server.close();
});

t.test("The hono async context still works", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/hono-async-context", {
    method: "GET",
  });

  const body = await response.text();
  t.equal(body, "test-value");
});

t.test("Proxy request", opts, async (t) => {
  const { Hono } = require("hono") as typeof import("hono");
  const { serve } =
    require("@hono/node-server") as typeof import("@hono/node-server");

  const app = new Hono();

  app.on(["GET", "POST"], "/proxy", async (c) => {
    const response = await globalThis.fetch(
      new Request("http://127.0.0.1:8768/body", {
        method: c.req.method,
        headers: c.req.raw.headers,
        // oxlint-disable-next-line no-invalid-fetch-options
        body: c.req.raw.body,
        // @ts-expect-error wrong types
        duplex: "half",
        redirect: "manual",
      })
    );
    // clone the response to return a response with modifiable headers
    return new Response(response.body, response);
  });

  app.post("/body", async (c) => {
    return await c.req.json();
  });

  const server = serve({
    fetch: app.fetch,
    port: 8767,
    hostname: "127.0.0.1",
  });

  const app2 = new Hono();
  app2.all("/*", async (c) => {
    return c.text(await c.req.text());
  });

  const server2 = serve({
    fetch: app2.fetch,
    port: 8768,
    hostname: "127.0.0.1",
  });

  const response = await fetch.fetch({
    url: new URL("http://127.0.0.1:8767/proxy"),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ a: 1 }),
  });
  t.equal(response.statusCode, 200);
  t.equal(response.body, JSON.stringify({ a: 1 }));

  // Cleanup servers
  server.close();
  server2.close();
});

t.test("Body parsing in middleware", opts, async (t) => {
  const { Hono } = require("hono") as typeof import("hono");

  const app = new Hono<{ Variables: { body: any } }>();

  app.use(async (c, next) => {
    c.set("body", await c.req.json());
    return next();
  });

  app.post("/", async (c) => {
    return c.json(getContext());
  });

  const response = await app.request("/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ x: 42 }),
  });

  const body = await response.json();
  t.match(body, {
    method: "POST",
    body: { x: 42 },
    source: "hono",
    route: "/",
  });
});

t.test("invalid json body", opts, async (t) => {
  const app = await getApp();

  const response = await app.request("/json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "invalid",
  });

  t.same(response.status, 400);
  t.same(await response.text(), "Invalid JSON");
});

t.test("bypass list works", opts, async (t) => {
  // Start a server with a real socket
  // The blocking is implemented in the HTTPServer source
  const { serve } =
    require("@hono/node-server") as typeof import("@hono/node-server");
  const server = serve({
    fetch: (await getApp()).fetch,
    port: 8769,
  });

  // It blocks bot
  const response = await fetch.fetch({
    url: new URL("http://127.0.0.1:8769/"),
    headers: {
      "X-Forwarded-For": "123.2.2.2",
      "User-Agent": "hacker",
    },
  });
  t.equal(response.statusCode, 403);
  t.equal(
    response.body,
    "You are not allowed to access this resource because you have been identified as a bot."
  );

  // It does not block bypassed IP
  const response2 = await fetch.fetch({
    url: new URL("http://127.0.0.1:8769/"),
    headers: {
      "X-Forwarded-For": "4.3.2.1",
      "User-Agent": "hacker",
    },
  });
  t.equal(response2.statusCode, 200);

  const response3 = await fetch.fetch({
    url: new URL("http://127.0.0.1:8769/"),
    headers: {
      "X-Forwarded-For": "123.1.2.2",
      "User-Agent": "hacker",
    },
  });
  t.equal(response3.statusCode, 200);

  const response4 = await fetch.fetch({
    url: new URL("http://127.0.0.1:8769/"),
    headers: {
      "X-Forwarded-For": "123.1.2.254",
      "User-Agent": "hacker",
    },
  });
  t.equal(response4.statusCode, 200);

  // Cleanup server
  server.close();
});

t.test("it rate limits based on group", opts, async (t) => {
  const app = await getApp();
  const response = await app.request("/rate-limited-group", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "200.1.2.1",
      "X-User-Id": "123",
      "X-Rate-Limit-Group": "default",
    },
  });
  t.match(response.status, 200);

  const response2 = await app.request("/rate-limited-group", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "200.1.2.2",
      "X-User-Id": "234",
      "X-Rate-Limit-Group": "default",
    },
  });
  t.match(response2.status, 200);

  const response3 = await app.request("/rate-limited-group", {
    method: "GET",
    headers: {
      "X-Forwarded-For": "200.1.2.3",
      "X-User-Id": "456",
      "X-Rate-Limit-Group": "default",
    },
  });

  t.match(response3.status, 429);
  t.match(await response3.text(), "You are rate limited by Zen.");
});

t.test("it respects forwarded host header", opts, async (t) => {
  const { serve } =
    require("@hono/node-server") as typeof import("@hono/node-server");

  const server = serve({
    fetch: (await getApp()).fetch,
    port: 8770,
  });

  const response = await fetch.fetch({
    url: new URL("http://127.0.0.1:8770/?abc=test"),
    method: "GET",
    headers: {
      accept: "application/json",
      "X-Forwarded-Host": "example.com",
      "X-Forwarded-Proto": "https",
    },
    timeoutInMS: 500,
  });

  t.match(JSON.parse(response.body), {
    url: "https://example.com/?abc=test",
    urlPath: "/",
    method: "GET",
    query: { abc: "test" },
    cookies: {},
    headers: { accept: "application/json" },
    source: "hono",
    route: "/",
  });

  server.close();
});
