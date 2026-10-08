import { Token } from "../agent/api/Token";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import { fetch } from "../helpers/fetch";
import { HTTPServer } from "./HTTPServer";
import { createTestAgent } from "../helpers/createTestAgent";
import { FetchListsAPIForTesting } from "../agent/api/FetchListsAPIForTesting";

// Before require("http")
const api = new ReportingAPIForTesting({
  success: true,
  configUpdatedAt: 0,
  allowedIPAddresses: [],
  blockedUserIds: [],
  endpoints: [
    {
      route: "/rate-limited",
      method: "GET",
      forceProtectionOff: false,
      allowedIPAddresses: [],
      rateLimiting: {
        enabled: true,
        maxRequests: 2,
        windowSizeInMS: 60 * 60 * 1000,
      },
    },
    {
      route: "/ip-allowed",
      method: "GET",
      forceProtectionOff: false,
      allowedIPAddresses: ["8.8.8.8"],
      // @ts-expect-error Testing
      rateLimiting: undefined,
    },
  ],
  heartbeatIntervalInMS: 10 * 60 * 1000,
});

const mockedFetchListAPI = new FetchListsAPIForTesting({
  allowedIPAddresses: [],
  blockedIPAddresses: [
    {
      key: "geoip/Belgium;BE",
      source: "geoip",
      ips: ["9.9.9.9"],
      description: "geo restrictions",
    },
  ],
  blockedUserAgents: "hackerbot",
  monitoredUserAgents: "",
  monitoredIPAddresses: [],
  userAgentDetails: [],
});

const agent = createTestAgent({
  token: new Token("123"),
  api,
  fetchListsAPI: mockedFetchListAPI,
});
agent.start([new HTTPServer()]);

t.setTimeout(30 * 1000);

t.beforeEach(() => {
  delete process.env.NODE_ENV;
});

const http = require("http") as typeof import("http");
const https = require("https") as typeof import("https");
const { readFileSync } = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");

// Test that addListener properly enforces firewall protection
t.test("it blocks IP address with addListener on http.createServer", async (t) => {
  const server = http.createServer();
  
  // Use addListener instead of on
  server.addListener("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3500, () => {
      Promise.all([
        fetch({
          url: new URL("http://localhost:3500"),
          method: "GET",
          headers: {
            "x-forwarded-for": "9.9.9.9",
          },
          timeoutInMS: 500,
          agent: new http.Agent({ keepAlive: false }),
        }),
        fetch({
          url: new URL("http://localhost:3500"),
          method: "GET",
          timeoutInMS: 500,
        }),
      ]).then(([response1, response2]) => {
        // Blocked IP should return 403
        t.equal(response1.statusCode, 403);
        t.equal(
          response1.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        // Normal IP should succeed
        t.equal(response2.statusCode, 200);
        server.close();
        resolve();
      });
    });
  });
});

// Test that once properly enforces firewall protection
t.test("it blocks IP address with once on http.createServer", async (t) => {
  const server = http.createServer();
  
  // Use once instead of on
  server.once("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3501, () => {
      fetch({
        url: new URL("http://localhost:3501"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        server.close();
        resolve();
      });
    });
  });
});

// Test that prependListener properly enforces firewall protection
t.test("it blocks IP address with prependListener on http.createServer", async (t) => {
  const server = http.createServer();
  
  // Use prependListener instead of on
  server.prependListener("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3502, () => {
      fetch({
        url: new URL("http://localhost:3502"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        server.close();
        resolve();
      });
    });
  });
});

// Test that prependOnceListener properly enforces firewall protection
t.test("it blocks IP address with prependOnceListener on http.createServer", async (t) => {
  const server = http.createServer();
  
  // Use prependOnceListener instead of on
  server.prependOnceListener("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3503, () => {
      fetch({
        url: new URL("http://localhost:3503"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        server.close();
        resolve();
      });
    });
  });
});

// Test that user-agent blocking works with addListener
t.test("it blocks user-agent with addListener on http.createServer", async (t) => {
  const server = http.createServer();
  
  server.addListener("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3504, () => {
      Promise.all([
        fetch({
          url: new URL("http://localhost:3504"),
          method: "GET",
          headers: {
            "user-agent": "hackerbot",
          },
          timeoutInMS: 500,
          agent: new http.Agent({ keepAlive: false }),
        }),
        fetch({
          url: new URL("http://localhost:3504"),
          method: "GET",
          headers: {
            "user-agent": "Mozilla/5.0",
          },
          timeoutInMS: 500,
        }),
      ]).then(([response1, response2]) => {
        // Blocked user-agent should return 403
        t.equal(response1.statusCode, 403);
        t.equal(
          response1.body,
          "You are not allowed to access this resource because you have been identified as a bot."
        );
        // Normal user-agent should succeed
        t.equal(response2.statusCode, 200);
        server.close();
        resolve();
      });
    });
  });
});

// Test that route IP allowlist works with addListener
t.test("it enforces route IP allowlist with addListener on http.createServer", async (t) => {
  const server = http.createServer();
  
  server.addListener("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  process.env.NODE_ENV = "production";

  await new Promise<void>((resolve) => {
    server.listen(3505, () => {
      Promise.all([
        fetch({
          url: new URL("http://localhost:3505/ip-allowed"),
          method: "GET",
          headers: {
            "x-forwarded-for": "8.8.8.8",
          },
          timeoutInMS: 500,
        }),
        fetch({
          url: new URL("http://localhost:3505/ip-allowed"),
          method: "GET",
          headers: {
            "x-forwarded-for": "1.2.3.4",
          },
          timeoutInMS: 500,
        }),
      ]).then(([response1, response2]) => {
        // Allowed IP should succeed
        t.equal(response1.statusCode, 200);
        // Non-allowed IP should be blocked
        t.equal(response2.statusCode, 403);
        t.same(
          response2.body,
          "Your IP address is not allowed to access this resource. (Your IP: 1.2.3.4)"
        );
        server.close();
        resolve();
      });
    });
  });
});

// Test directly constructed Server with addListener
t.test("it blocks IP address with addListener on new http.Server()", async (t) => {
  const server = new http.Server();
  
  server.addListener("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3506, () => {
      fetch({
        url: new URL("http://localhost:3506"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        server.close();
        resolve();
      });
    });
  });
});

// Test directly constructed Server with on
t.test("it blocks IP address with on on new http.Server()", async (t) => {
  const server = new http.Server();
  
  server.on("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3507, () => {
      fetch({
        url: new URL("http://localhost:3507"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        server.close();
        resolve();
      });
    });
  });
});

// Test directly constructed Server with prependListener
t.test("it blocks IP address with prependListener on new http.Server()", async (t) => {
  const server = new http.Server();
  
  server.prependListener("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3508, () => {
      fetch({
        url: new URL("http://localhost:3508"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        server.close();
        resolve();
      });
    });
  });
});

// Test directly constructed HTTPS Server with addListener
t.test("it blocks IP address with addListener on new https.Server()", async (t) => {
  // Otherwise, the self-signed certificate will be rejected
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const server = new https.Server({
    key: readFileSync(path.resolve(__dirname, "fixtures/key.pem")),
    cert: readFileSync(path.resolve(__dirname, "fixtures/cert.pem")),
  });
  
  server.addListener("request", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3509, () => {
      fetch({
        url: new URL("https://localhost:3509"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new https.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        server.close();
        resolve();
      });
    });
  });
});

// Test that context is properly set with addListener
t.test("it sets context properly with addListener on http.createServer", async (t) => {
  const server = http.createServer();
  
  server.addListener("request", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3510, () => {
      fetch({
        url: new URL("http://localhost:3510/test?foo=bar"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context, {
          url: "/test?foo=bar",
          method: "GET",
          headers: { host: "localhost:3510", connection: "close" },
          query: { foo: "bar" },
          route: "/test",
          source: "http.createServer",
          routeParams: {},
          cookies: {},
          remoteAddress:
            getMajorNodeVersion() === 16 ? "::ffff:127.0.0.1" : "::1",
        });
        server.close();
        resolve();
      });
    });
  });
});

// Test that context is properly set with prependListener on directly constructed Server
t.test("it sets context properly with prependListener on new http.Server()", async (t) => {
  const server = new http.Server();
  
  server.prependListener("request", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3511, () => {
      fetch({
        url: new URL("http://localhost:3511/test?foo=bar"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context, {
          url: "/test?foo=bar",
          method: "GET",
          headers: { host: "localhost:3511", connection: "close" },
          query: { foo: "bar" },
          route: "/test",
          source: "http.Server",
          routeParams: {},
          cookies: {},
          remoteAddress:
            getMajorNodeVersion() === 16 ? "::ffff:127.0.0.1" : "::1",
        });
        server.close();
        resolve();
      });
    });
  });
});

// Test multiple listeners with different registration methods
t.test("it blocks IP with multiple listeners using different methods", async (t) => {
  const server = http.createServer();
  
  let handler1Called = false;
  let handler2Called = false;
  let handler3Called = false;
  
  server.on("request", (req, res) => {
    handler1Called = true;
    if (res.headersSent) return;
    res.setHeader("Content-Type", "text/plain");
    res.end("Handler 1");
  });
  
  server.addListener("request", (req, res) => {
    handler2Called = true;
    if (res.headersSent) return;
    res.setHeader("Content-Type", "text/plain");
    res.end("Handler 2");
  });
  
  server.prependListener("request", (req, res) => {
    handler3Called = true;
    if (res.headersSent) return;
    res.setHeader("Content-Type", "text/plain");
    res.end("Handler 3");
  });

  await new Promise<void>((resolve) => {
    server.listen(3512, () => {
      fetch({
        url: new URL("http://localhost:3512"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403 before any handler is called
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        // None of the handlers should have been called because IP was blocked
        t.equal(handler1Called, false);
        t.equal(handler2Called, false);
        t.equal(handler3Called, false);
        server.close();
        resolve();
      });
    });
  });
});

// Test that directly constructed Server with callback still works
t.test("it blocks IP address on new http.Server(callback)", async (t) => {
  const server = new http.Server((req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3513, () => {
      fetch({
        url: new URL("http://localhost:3513"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        server.close();
        resolve();
      });
    });
  });
});

// Test that directly constructed Server with callback and then addListener still works
t.test("it blocks IP address on new http.Server(callback) with addListener", async (t) => {
  const server = new http.Server((req, res) => {
    if (res.headersSent) return;
    res.setHeader("Content-Type", "text/plain");
    res.end("Callback handler");
  });
  
  server.addListener("request", (req, res) => {
    if (res.headersSent) return;
    res.setHeader("Content-Type", "text/plain");
    res.end("addListener handler");
  });

  await new Promise<void>((resolve) => {
    server.listen(3514, () => {
      fetch({
        url: new URL("http://localhost:3514"),
        method: "GET",
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        timeoutInMS: 500,
        agent: new http.Agent({ keepAlive: false }),
      }).then((response) => {
        // Blocked IP should return 403
        t.equal(response.statusCode, 403);
        t.equal(
          response.body,
          "Your IP address is blocked due to geo restrictions. (Your IP: 9.9.9.9)"
        );
        server.close();
        resolve();
      });
    });
  });
});
