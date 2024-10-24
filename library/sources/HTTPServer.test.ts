import { Token } from "../agent/api/Token";
import { wrap } from "../helpers/wrap";
import * as pkg from "../helpers/isPackageInstalled";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";

import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import { fetch } from "../helpers/fetch";
import { HTTPServer } from "./HTTPServer";
import { createTestAgent } from "../helpers/createTestAgent";

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
        maxRequests: 3,
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
const agent = createTestAgent({
  token: new Token("123"),
  api,
});
agent.start([new HTTPServer()]);

t.setTimeout(30 * 1000);

t.beforeEach(() => {
  delete process.env.AIKIDO_MAX_BODY_SIZE_MB;
  delete process.env.NODE_ENV;
  delete process.env.NEXT_DEPLOYMENT_ID;
});

const http = require("http") as typeof import("http");
const https = require("https") as typeof import("https");

t.test("it wraps the createServer function of http module", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  http.globalAgent = new http.Agent({ keepAlive: false });

  await new Promise<void>((resolve) => {
    server.listen(3314, () => {
      fetch({
        url: new URL("http://localhost:3314"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context, {
          url: "/",
          method: "GET",
          headers: { host: "localhost:3314", connection: "close" },
          query: {},
          route: "/",
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

t.test("it wraps the createServer function of https module", async () => {
  const { readFileSync } = require("fs");
  const path = require("path");

  // Otherwise, the self-signed certificate will be rejected
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const server = https.createServer(
    {
      key: readFileSync(path.resolve(__dirname, "fixtures/key.pem")),
      cert: readFileSync(path.resolve(__dirname, "fixtures/cert.pem")),
    },
    (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getContext()));
    }
  );

  https.globalAgent = new https.Agent({ keepAlive: false });

  await new Promise<void>((resolve) => {
    server.listen(3315, () => {
      fetch({
        url: new URL("https://localhost:3315"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context, {
          url: "/",
          method: "GET",
          headers: { host: "localhost:3315", connection: "close" },
          query: {},
          route: "/",
          source: "https.createServer",
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

t.test("it parses query parameters", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3317, () => {
      fetch({
        url: new URL("http://localhost:3317?foo=bar&baz=qux"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.query, { foo: "bar", baz: "qux" });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it discovers routes", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3340, () => {
      fetch({
        url: new URL("http://localhost:3340/foo/bar"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
      }).then(({ body }) => {
        t.same(
          agent
            .getRoutes()
            .asArray()
            .find((route) => route.path === "/foo/bar"),
          {
            path: "/foo/bar",
            method: "GET",
            hits: 1,
            graphql: undefined,
            apispec: {},
          }
        );
        server.close();
        resolve();
      });
    });
  });
});

t.test(
  "it does not discover route if server response is error code",
  async (t) => {
    const server = http.createServer((req, res) => {
      res.statusCode = 404;
      res.end();
    });

    await new Promise<void>((resolve) => {
      server.listen(3341, () => {
        fetch({
          url: new URL("http://localhost:3341/not-found"),
          method: "GET",
          headers: {},
          timeoutInMS: 500,
        }).then(() => {
          t.equal(
            agent
              .getRoutes()
              .asArray()
              .find((route) => route.path === "/not-found"),
            undefined
          );
          server.close();
          resolve();
        });
      });
    });
  }
);

t.test("it parses cookies", async (t) => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3318, () => {
      fetch({
        url: new URL("http://localhost:3318"),
        method: "GET",
        headers: {
          Cookie: "foo=bar; baz=qux",
        },
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.cookies, { foo: "bar", baz: "qux" });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it parses x-forwarded-for header with proxy", async (t) => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3316, () => {
      fetch({
        url: new URL("http://localhost:3316"),
        method: "GET",
        headers: {
          "x-forwarded-for":
            "203.0.113.195,2001:db8:85a3:8d3:1319:8a2e:370:7348,198.51.100.178",
        },
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.remoteAddress, "203.0.113.195");
        server.close();
        resolve();
      });
    });
  });
});

t.test("it uses x-forwarded-for header", async (t) => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3350, () => {
      fetch({
        url: new URL("http://localhost:3350"),
        method: "GET",
        headers: {
          "x-forwarded-for": "203.0.113.195",
        },
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.remoteAddress, "203.0.113.195");
        server.close();
        resolve();
      });
    });
  });
});

t.test("it sets body in context", async (t) => {
  // Enables body parsing
  process.env.NEXT_DEPLOYMENT_ID = "";

  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3319, () => {
      fetch({
        url: new URL("http://localhost:3319"),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ foo: "bar" }),
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.body, { foo: "bar" });
        server.close();
        resolve();
      });
    });
  });
});

function generateJsonPayload(sizeInMb: number) {
  const doubleQuotes = 2;
  const sizeInBytes = sizeInMb * 1024 * 1024 - doubleQuotes;

  return JSON.stringify("a".repeat(sizeInBytes));
}

t.test("it sends 413 when body is larger than 20 Mb", async (t) => {
  // Enables body parsing
  process.env.NEXT_DEPLOYMENT_ID = "";

  const server = http.createServer((req, res) => {
    t.fail();
  });

  await new Promise<void>((resolve) => {
    server.listen(3320, () => {
      fetch({
        url: new URL("http://localhost:3320"),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: generateJsonPayload(21),
        timeoutInMS: 2000,
      }).then(({ body, statusCode }) => {
        t.equal(
          body,
          "This request was aborted by Aikido firewall because the body size exceeded the maximum allowed size. Use AIKIDO_MAX_BODY_SIZE_MB to increase the limit."
        );
        t.equal(statusCode, 413);
        server.close();
        resolve();
      });
    });
  });
});

t.test("body that is not JSON is ignored", async (t) => {
  // Enables body parsing
  process.env.NEXT_DEPLOYMENT_ID = "";

  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3321, () => {
      fetch({
        url: new URL("http://localhost:3321"),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "not json",
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.body, undefined);
        server.close();
        resolve();
      });
    });
  });
});

t.test("it uses limit from AIKIDO_MAX_BODY_SIZE_MB", async (t) => {
  // Enables body parsing
  process.env.NEXT_DEPLOYMENT_ID = "";

  const server = http.createServer((req, res) => {
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(3322, () => {
      process.env.AIKIDO_MAX_BODY_SIZE_MB = "1";
      Promise.all([
        fetch({
          url: new URL("http://localhost:3322"),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: generateJsonPayload(1),
          timeoutInMS: 2000,
        }),
        fetch({
          url: new URL("http://localhost:3322"),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: generateJsonPayload(2),
          timeoutInMS: 2000,
        }),
      ])
        .then(([response1, response2]) => {
          t.equal(response1.statusCode, 200);
          t.equal(response2.statusCode, 413);
        })
        .catch((error) => {
          t.fail(`Unexpected error: ${error.message} ${error.stack}`);
        })
        .finally(() => {
          server.close();
          resolve();
        });
    });
  });
});

t.test("it wraps on request event of http", async () => {
  const server = http.createServer();
  server.on("request", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  http.globalAgent = new http.Agent({ keepAlive: false });

  await new Promise<void>((resolve) => {
    server.listen(3367, () => {
      fetch({
        url: new URL("http://localhost:3367"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context, {
          url: "/",
          method: "GET",
          headers: { host: "localhost:3367", connection: "close" },
          query: {},
          route: "/",
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

t.test("it wraps on request event of https", async () => {
  const { readFileSync } = require("fs");
  const path = require("path");

  // Otherwise, the self-signed certificate will be rejected
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const server = https.createServer({
    key: readFileSync(path.resolve(__dirname, "fixtures/key.pem")),
    cert: readFileSync(path.resolve(__dirname, "fixtures/cert.pem")),
  });

  server.on("request", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  https.globalAgent = new https.Agent({ keepAlive: false });

  await new Promise<void>((resolve) => {
    server.listen(3361, () => {
      fetch({
        url: new URL("https://localhost:3361"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context, {
          url: "/",
          method: "GET",
          headers: { host: "localhost:3361", connection: "close" },
          query: {},
          route: "/",
          source: "https.createServer",
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

t.test("it checks if IP can access route", async (t) => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  process.env.NODE_ENV = "production";

  await new Promise<void>((resolve) => {
    server.listen(3324, () => {
      Promise.all([
        fetch({
          url: new URL("http://localhost:3324/ip-allowed"),
          method: "GET",
          headers: {
            "x-forwarded-for": "8.8.8.8",
          },
          timeoutInMS: 500,
        }),
        fetch({
          url: new URL("http://localhost:3324/ip-allowed"),
          method: "GET",
          headers: {},
          timeoutInMS: 500,
        }),
        fetch({
          url: new URL("http://localhost:3324/ip-allowed"),
          method: "GET",
          headers: {
            "x-forwarded-for": "1.2.3.4",
          },
          timeoutInMS: 500,
        }),
      ]).then(([response1, response2, response3]) => {
        t.equal(response1.statusCode, 200);
        t.equal(response2.statusCode, 200);
        t.equal(response3.statusCode, 403);
        t.same(
          response3.body,
          "Your IP address is not allowed to access this resource. (Your IP: 1.2.3.4)"
        );
        server.close();
        resolve();
      });
    });
  });
});
