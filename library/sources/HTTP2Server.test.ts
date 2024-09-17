import * as t from "tap";
import { Token } from "../agent/api/Token";
import { connect, IncomingHttpHeaders } from "http2";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { HTTPServer } from "./HTTPServer";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import { wrap } from "../helpers/wrap";
import * as pkg from "../helpers/isPackageInstalled";
import { readFileSync } from "fs";
import { resolve } from "path";
import { FileSystem } from "../sinks/FileSystem";

const originalIsPackageInstalled = pkg.isPackageInstalled;
wrap(pkg, "isPackageInstalled", function wrap() {
  return function wrap(name: string) {
    // So that it thinks next is installed
    if (name === "next") {
      return true;
    }
    return originalIsPackageInstalled(name);
  };
});

// Allow self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Before require
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
    {
      route: "/rate-limited-2",
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
  undefined
);
agent.start([new HTTPServer(), new FileSystem()]);

t.beforeEach(() => {
  delete process.env.AIKIDO_MAX_BODY_SIZE_MB;
});

let _client: ReturnType<typeof connect> | undefined;

function http2Request(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body?: string,
  reuseClient?: boolean
) {
  return new Promise<{ headers: IncomingHttpHeaders; body: string }>(
    (resolve, reject) => {
      if (!reuseClient || !_client) {
        _client = connect(url);
      }
      const req = _client.request({
        ":path": url.pathname + url.search,
        ":method": method,
        "content-length": body ? Buffer.byteLength(body) : 0,
        ...headers,
      });

      let respHeaders: IncomingHttpHeaders;
      let resData = "";

      req.on("error", (err) => {
        reject(err);
      });

      req.on("response", (headers, flags) => {
        respHeaders = headers;
      });

      req.on("data", (chunk) => {
        resData += chunk;
      });
      req.on("end", () => {
        _client!.close();
        resolve({ headers: respHeaders, body: resData });
      });
      if (body) {
        return req.end(body);
      }
      req.end();
    }
  );
}

const http2 = require("http2");

function createMinimalTestServer() {
  const server = http2.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });
  return server;
}

function createMinimalTestServerWithStream() {
  const server = http2.createServer();
  server.on("stream", (stream, headers) => {
    stream.respond({ ":status": 200 });
    stream.end(JSON.stringify(getContext()));
  });
  return server;
}

t.test("it wraps the createServer function of http2 module", async () => {
  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3415, () => {
      http2Request(new URL("http://localhost:3415"), "GET", {}).then(
        ({ body }) => {
          const context = JSON.parse(body);
          t.match(context, {
            url: "/",
            method: "GET",
            headers: {
              ":path": "/",
              ":method": "GET",
              ":authority": "localhost:3415",
              ":scheme": "http",
            },
            query: {},
            route: "/",
            source: "http2.createServer",
            routeParams: {},
            cookies: {},
          });
          t.ok(isLocalhostIP(context.remoteAddress));
          server.close();
          resolve();
        }
      );
    });
  });
});

t.test("it parses query parameters", async () => {
  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3416, () => {
      http2Request(
        new URL("http://localhost:3416?foo=bar&baz=qux"),
        "GET",
        {}
      ).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.query, { foo: "bar", baz: "qux" });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it discovers routes", async () => {
  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3417, () => {
      http2Request(new URL("http://localhost:3417/foo/bar"), "GET", {}).then(
        ({}) => {
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
              body: undefined,
              query: undefined,
            }
          );
          server.close();
          resolve();
        }
      );
    });
  });
});

t.test("it does not discover routes with 404 status code", async () => {
  const server = http2.createServer((req, res) => {
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(3418, () => {
      http2Request(new URL("http://localhost:3418/not-found"), "GET", {}).then(
        ({}) => {
          t.same(
            agent
              .getRoutes()
              .asArray()
              .find((route) => route.path === "/not-found"),
            undefined
          );
          server.close();
          resolve();
        }
      );
    });
  });
});

t.test("it parses cookies", async () => {
  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3419, () => {
      http2Request(new URL("http://localhost:3419"), "GET", {
        cookie: "foo=bar; baz=qux",
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.cookies, { foo: "bar", baz: "qux" });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it sets body in context", async () => {
  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3420, () => {
      http2Request(
        new URL("http://localhost:3420"),
        "POST",
        {
          "Content-Type": "application/json",
        },
        JSON.stringify({ foo: "bar" })
      ).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.body, { foo: "bar" });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it sends 413 when body is larger than 20 Mb", async () => {
  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3421, () => {
      http2Request(
        new URL("http://localhost:3421"),
        "POST",
        {
          "Content-Type": "application/json",
        },
        "a".repeat(20 * 1024 * 1024 + 1)
      ).then(({ headers, body }) => {
        t.same(headers[":status"], 413);
        t.same(
          body,
          "This request was aborted by Aikido firewall because the body size exceeded the maximum allowed size. Use AIKIDO_MAX_BODY_SIZE_MB to increase the limit."
        );
        server.close();
        resolve();
      });
    });
  });
});

t.test("it rate limits requests", async () => {
  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3422, async () => {
      const { headers } = await http2Request(
        new URL("http://localhost:3422/rate-limited"),
        "GET",
        {}
      );
      t.same(headers[":status"], 200);

      const { headers: headers2 } = await http2Request(
        new URL("http://localhost:3422/rate-limited"),
        "GET",
        {}
      );
      t.same(headers2[":status"], 200);

      const { headers: headers3 } = await http2Request(
        new URL("http://localhost:3422/rate-limited"),
        "GET",
        {}
      );
      t.same(headers3[":status"], 200);

      const { headers: headers4 } = await http2Request(
        new URL("http://localhost:3422/rate-limited"),
        "GET",
        {}
      );
      t.same(headers4[":status"], 429);

      server.close();
      resolve();
    });
  });
});

t.test("it works then using the on request event", async () => {
  const server = http2.createServer();

  server.on("request", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3423, () => {
      http2Request(new URL("http://localhost:3423"), "GET", {}).then(
        ({ body }) => {
          const context = JSON.parse(body);
          t.match(context, {
            url: "/",
            method: "GET",
            headers: {
              ":path": "/",
              ":method": "GET",
              ":authority": "localhost:3423",
              ":scheme": "http",
            },
            query: {},
            route: "/",
            source: "http2.createServer",
            routeParams: {},
            cookies: {},
          });
          t.ok(isLocalhostIP(context.remoteAddress));
          server.close();
          resolve();
        }
      );
    });
  });
});

t.test("it works then using the on stream event", async () => {
  const server = createMinimalTestServerWithStream();

  await new Promise<void>((resolve) => {
    server.listen(3424, () => {
      http2Request(new URL("http://localhost:3424?test=abc"), "GET", {
        cookie: "foo=bar; baz=qux",
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.match(context, {
          url: "/",
          method: "GET",
          headers: {
            ":path": "/",
            ":method": "GET",
            ":authority": "localhost:3424",
            ":scheme": "http",
          },
          query: { test: "abc" },
          route: "/",
          source: "http2.createServer",
          routeParams: {},
          cookies: { foo: "bar", baz: "qux" },
        });
        t.ok(isLocalhostIP(context.remoteAddress));
        server.close();
        resolve();
      });
    });
  });
});

t.test("it discovers routes using stream event", async () => {
  const server = createMinimalTestServerWithStream();

  await new Promise<void>((resolve) => {
    server.listen(3425, () => {
      http2Request(
        new URL("http://localhost:3425/foo/bar/stream"),
        "GET",
        {}
      ).then(({}) => {
        t.same(
          agent
            .getRoutes()
            .asArray()
            .find((route) => route.path === "/foo/bar/stream"),
          {
            path: "/foo/bar/stream",
            method: "GET",
            hits: 1,
            graphql: undefined,
            body: undefined,
            query: undefined,
          }
        );
        server.close();
        resolve();
      });
    });
  });
});

t.test("it does not discover routes with 404 status code", async () => {
  const server = http2.createServer();
  server.on("stream", (stream, headers) => {
    stream.respond({ ":status": 404 });
    stream.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(3426, () => {
      http2Request(
        new URL("http://localhost:3426/not-found-stream"),
        "GET",
        {}
      ).then(({}) => {
        t.same(
          agent
            .getRoutes()
            .asArray()
            .find((route) => route.path === "/not-found-stream"),
          undefined
        );
        server.close();
        resolve();
      });
    });
  });
});

t.test("it wraps the createSecureServer function of http2 module", async () => {
  const server = http2.createSecureServer(
    {
      key: readFileSync(resolve(__dirname, "fixtures/key.pem")),
      cert: readFileSync(resolve(__dirname, "fixtures/cert.pem")),
      secureContext: {},
    },
    (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getContext()));
    }
  );

  await new Promise<void>((resolve) => {
    server.listen(3427, () => {
      http2Request(new URL("https://localhost:3427"), "GET", {}).then(
        ({ body }) => {
          const context = JSON.parse(body);
          t.match(context, {
            url: "/",
            method: "GET",
            headers: {
              ":path": "/",
              ":method": "GET",
              ":authority": "localhost:3427",
              ":scheme": "http",
            },
            query: {},
            route: "/",
            source: "http2.createServer",
            routeParams: {},
            cookies: {},
          });
          t.ok(isLocalhostIP(context.remoteAddress));
          server.close();
          resolve();
        }
      );
    });
  });
});

t.test("it wraps the createSecureServer on request event", async () => {
  const server = http2.createSecureServer({
    key: readFileSync(resolve(__dirname, "fixtures/key.pem")),
    cert: readFileSync(resolve(__dirname, "fixtures/cert.pem")),
    secureContext: {},
  });

  server.on("request", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3428, () => {
      http2Request(new URL("https://localhost:3428"), "GET", {}).then(
        ({ body }) => {
          const context = JSON.parse(body);
          t.match(context, {
            url: "/",
            method: "GET",
            headers: {
              ":path": "/",
              ":method": "GET",
              ":authority": "localhost:3428",
              ":scheme": "http",
            },
            query: {},
            route: "/",
            source: "http2.createServer",
            routeParams: {},
            cookies: {},
          });
          t.ok(isLocalhostIP(context.remoteAddress));
          server.close();
          resolve();
        }
      );
    });
  });
});

t.test("it wraps the createSecureServer stream event", async () => {
  const server = http2.createSecureServer({
    key: readFileSync(resolve(__dirname, "fixtures/key.pem")),
    cert: readFileSync(resolve(__dirname, "fixtures/cert.pem")),
    secureContext: {},
  });

  server.on("stream", (stream, headers) => {
    stream.respond({ ":status": 200 });
    stream.end(JSON.stringify(getContext()));
  });

  await new Promise<void>((resolve) => {
    server.listen(3429, () => {
      http2Request(new URL("https://localhost:3429"), "GET", {}).then(
        ({ body }) => {
          const context = JSON.parse(body);
          t.match(context, {
            url: "/",
            method: "GET",
            headers: {
              ":path": "/",
              ":method": "GET",
              ":authority": "localhost:3429",
              ":scheme": "http",
            },
            query: {},
            route: "/",
            source: "http2.createServer",
            routeParams: {},
            cookies: {},
          });
          t.ok(isLocalhostIP(context.remoteAddress));
          server.close();
          resolve();
        }
      );
    });
  });
});

t.test("it rate limits requests using stream event", async () => {
  const server = createMinimalTestServerWithStream();

  await new Promise<void>((resolve) => {
    server.listen(3430, async () => {
      const { headers } = await http2Request(
        new URL("http://localhost:3430/rate-limited-2"),
        "GET",
        {}
      );
      t.same(headers[":status"], 200);

      const { headers: headers2 } = await http2Request(
        new URL("http://localhost:3430/rate-limited-2"),
        "GET",
        {}
      );
      t.same(headers2[":status"], 200);

      const { headers: headers3 } = await http2Request(
        new URL("http://localhost:3430/rate-limited-2"),
        "GET",
        {}
      );
      t.same(headers3[":status"], 200);

      const { headers: headers4 } = await http2Request(
        new URL("http://localhost:3430/rate-limited-2"),
        "GET",
        {}
      );
      t.same(headers4[":status"], 429);

      server.close();
      resolve();
    });
  });
});

t.test("real injection test", async (t) => {
  const server = http2.createServer();
  server.on("stream", (stream, headers) => {
    const url = new URL(headers[":path"] as string, "http://localhost");
    const path = url.searchParams.get("path");
    if (!path) {
      return stream.end();
    }
    try {
      const file = readFileSync(path);
      stream.respond({ ":status": 200 });
      stream.end(file);
    } catch (e) {
      stream.respond({ ":status": 500 });
      stream.end(e.message);
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(3431, () => {
      http2Request(
        new URL("http://localhost:3431?path=/etc/passwd"),
        "GET",
        {}
      ).then(({ body }) => {
        t.match(body, /Zen has blocked a path traversal attack/);
        server.close();
        resolve();
      });
    });
  });
});

t.test("using http2 push still works", async (t) => {
  const server = http2.createServer();
  server.on("stream", (stream, headers) => {
    stream.pushStream({ ":path": "/pushed" }, (err, pushStream) => {
      pushStream.respond({ ":status": 200 });
      pushStream.end("pushed");
    });
    stream.respond({ ":status": 200 });
    stream.end("main");
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(3432, () => {
      const client = connect("http://localhost:3432");

      client.on("stream", (pushedStream, requestHeaders) => {
        pushedStream.on("data", (chunk) => {
          t.same(chunk.toString(), "pushed");
        });
        pushedStream.on("end", () => {
          client.close();
          server.close();
          resolve();
        });
      });

      const req = client.request({
        ":path": "/",
        ":method": "GET",
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.on("data", (chunk) => {
        t.same(chunk.toString(), "main");
      });

      req.end();
    });
  });
});

t.test("it works then using the on stream end event", async () => {
  const server = http2.createServer();
  server.on("stream", (stream, headers) => {
    stream.on("end", () => {
      stream.respond({ ":status": 200 });
      stream.end(JSON.stringify(getContext()));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(3433, () => {
      http2Request(new URL("http://localhost:3433?test=abc"), "POST", {
        cookie: "foo=bar; baz=qux",
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.match(context, {
          url: "/",
          method: "POST",
          headers: {
            ":path": "/",
            ":method": "POST",
            ":authority": "localhost:3433",
            ":scheme": "http",
          },
          query: { test: "abc" },
          route: "/",
          source: "http2.createServer",
          routeParams: {},
          cookies: { foo: "bar", baz: "qux" },
        });
        t.ok(isLocalhostIP(context.remoteAddress));
        server.close();
        resolve();
      });
    });
  });
});
