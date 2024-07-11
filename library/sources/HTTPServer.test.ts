import { Token } from "../agent/api/Token";
import { wrap } from "../helpers/wrap";
import * as pkg from "../helpers/isPackageInstalled";

wrap(pkg, "isPackageInstalled", function wrap() {
  return function wrap() {
    // So that it thinks next is installed
    return true;
  };
});

import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { fetch } from "../helpers/fetch";
import { HTTPServer } from "./HTTPServer";

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
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 60 * 60 * 1000,
      },
    },
  ],
  heartbeatIntervalInMS: 10 * 60 * 1000,
});
const agent = new Agent(
  true,
  new LoggerNoop(),
  api,
  new Token("abc"),
  "lambda"
);
agent.start([new HTTPServer()]);

t.beforeEach(() => {
  delete process.env.AIKIDO_MAX_BODY_SIZE_MB;
});

t.test("it wraps the createServer function of http module", async () => {
  const http = require("http");
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
          remoteAddress: process.version.startsWith("v16")
            ? "::ffff:127.0.0.1"
            : "::1",
        });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it wraps the createServer function of https module", async () => {
  const https = require("https");
  const { readFileSync } = require("fs");
  const path = require("path");

  // Otherwise, the self-signed certificate will be rejected
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const server = https.createServer(
    {
      key: readFileSync(path.resolve(__dirname, "fixtures/key.pem")),
      cert: readFileSync(path.resolve(__dirname, "fixtures/cert.pem")),
      secureContext: {},
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
          remoteAddress: process.version.startsWith("v16")
            ? "::ffff:127.0.0.1"
            : "::1",
        });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it parses query parameters", async () => {
  const http = require("http");
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
  const http = require("http");
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
  async () => {
    const http = require("http");
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

t.test("it parses cookies", async () => {
  const http = require("http");
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

t.test("it parses x-forwarded-for header with proxy", async () => {
  const http = require("http");
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

t.test("it uses x-forwarded-for header", async () => {
  const http = require("http");
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

t.test("it sets body in context", async () => {
  const http = require("http");
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

t.test("it sends 413 when body is larger than 20 Mb", async () => {
  const http = require("http");

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

t.test("body that is not JSON is ignored", async () => {
  const http = require("http");
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

t.test("it uses limit from AIKIDO_MAX_BODY_SIZE_MB", async () => {
  const http = require("http");

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

t.test("it rate limits requests", async () => {
  const http = require("http");

  const server = http.createServer((req, res) => {
    res.end();
  });

  const headers = {
    "x-forwarded-for": "1.2.3.4",
  };

  await new Promise<void>((resolve) => {
    server.listen(3323, () => {
      Promise.all([
        fetch({
          url: new URL("http://localhost:3323/rate-limited"),
          method: "GET",
          headers: headers,
          timeoutInMS: 500,
        }),
        fetch({
          url: new URL("http://localhost:3323/rate-limited"),
          method: "GET",
          headers: headers,
          timeoutInMS: 500,
        }),
        fetch({
          url: new URL("http://localhost:3323/rate-limited"),
          method: "GET",
          headers: headers,
          timeoutInMS: 500,
        }),
      ])
        .then(([response1, response2, response3]) => {
          t.equal(response1.statusCode, 200);
          t.equal(response2.statusCode, 200);
          t.equal(response3.statusCode, 200);
        })
        .then(() => {
          fetch({
            url: new URL("http://localhost:3323/rate-limited"),
            method: "GET",
            headers: headers,
            timeoutInMS: 500,
          }).then(({ body, statusCode }) => {
            t.equal(statusCode, 429);
            t.equal(
              body,
              "You are rate limited by Aikido firewall. (Your IP: 1.2.3.4)"
            );
            server.close();
            resolve();
          });
        })
        .catch((error) => {
          t.fail(`Unexpected error: ${error.message} ${error.stack}`);
        });
    });
  });
});

t.test("it wraps on request event of http", async () => {
  const http = require("http");
  const server = http.createServer();
  server.on("request", (req, res) => {
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
          remoteAddress: process.version.startsWith("v16")
            ? "::ffff:127.0.0.1"
            : "::1",
        });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it wraps on request event of https", async () => {
  const https = require("https");
  const { readFileSync } = require("fs");
  const path = require("path");

  // Otherwise, the self-signed certificate will be rejected
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const server = https.createServer({
    key: readFileSync(path.resolve(__dirname, "fixtures/key.pem")),
    cert: readFileSync(path.resolve(__dirname, "fixtures/cert.pem")),
    secureContext: {},
  });

  server.on("request", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

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
          remoteAddress: process.version.startsWith("v16")
            ? "::ffff:127.0.0.1"
            : "::1",
        });
        server.close();
        resolve();
      });
    });
  });
});
