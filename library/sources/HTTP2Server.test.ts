import * as t from "tap";
import { Token } from "../agent/api/Token";
import type { IncomingHttpHeaders } from "http2";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import { HTTPServer } from "./HTTPServer";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import { resolve } from "path";
import { FileSystem } from "../sinks/FileSystem";
import { createTestAgent } from "../helpers/createTestAgent";

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
const agent = createTestAgent({
  token: new Token("123"),
  api,
});
agent.start([new HTTPServer(), new FileSystem()]);

const { readFileSync } = require("fs");
const { connect } = require("http2") as typeof import("http2");

t.beforeEach(() => {
  delete process.env.AIKIDO_MAX_BODY_SIZE_MB;
  delete process.env.NEXT_DEPLOYMENT_ID;
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

const http2 = require("http2") as typeof import("http2");

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
        () => {
          t.same(
            agent
              .getRoutes()
              .asArray()
              .find((route) => route.path === "/foo/bar"),
            {
              path: "/foo/bar",
              method: "GET",
              hits: 1,
              rateLimitedCount: 0,
              graphql: undefined,
              apispec: {},
              graphQLSchema: undefined,
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
        () => {
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
  // Enables body parsing
  process.env.NEXT_DEPLOYMENT_ID = "";

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
  // Enables body parsing
  process.env.NEXT_DEPLOYMENT_ID = "";

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
          url: "/?test=abc",
          method: "GET",
          headers: {
            ":path": "/?test=abc",
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
      ).then(() => {
        t.same(
          agent
            .getRoutes()
            .asArray()
            .find((route) => route.path === "/foo/bar/stream"),
          {
            path: "/foo/bar/stream",
            method: "GET",
            hits: 1,
            rateLimitedCount: 0,
            graphql: undefined,
            apispec: {},
            graphQLSchema: undefined,
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
      ).then(() => {
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
              ":scheme": "https",
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
              ":scheme": "https",
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
              ":scheme": "https",
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
      stream.end(e instanceof Error ? e.message : "");
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
          url: "/?test=abc",
          method: "POST",
          headers: {
            ":path": "/?test=abc",
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

t.test("it reports attack waves", async (t) => {
  const server = http2.createServer();
  server.on("stream", (stream, headers) => {
    stream.respond({ ":status": 404 });
    stream.end("Not found");
  });

  api.clear();

  await new Promise<void>((resolve) => {
    server.listen(3434, async () => {
      for (let i = 0; i < 16; i++) {
        const result = await http2Request(
          new URL("http://localhost:3434/.env"),
          "GET",
          {}
        );
        t.same(result.headers[":status"], 404);
      }

      t.match(api.getEvents(), [
        {
          type: "detected_attack_wave",
          attack: {
            metadata: {},
            user: undefined,
          },
          request: {
            source: "http2.createServer",
          },
          agent: {
            library: "firewall-node",
          },
        },
      ]);

      await agent.flushStats(1000);

      t.match(api.getEvents(), [
        {
          type: "detected_attack_wave",
          attack: {
            metadata: {},
            user: undefined,
          },
          request: {
            source: "http2.createServer",
          },
          agent: {
            library: "firewall-node",
          },
        },
        {
          type: "heartbeat",
          stats: {
            requests: {
              attackWaves: {
                total: 1,
                blocked: 0,
              },
            },
          },
        },
      ]);

      server.close();
      resolve();
    });
  });
});

t.test("it parses Multipart body", async () => {
  // Enables body parsing
  process.env.NEXT_DEPLOYMENT_ID = "";

  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3435, () => {
      http2Request(
        new URL("http://localhost:3435"),
        "POST",
        {
          "Content-Type":
            "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW",
        },
        '------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalue1\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="field2"\r\n\r\n{"abc": "test", "arr": ["c"]}\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--'
      ).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.body, {
          fields: [
            { name: "field1", value: "value1" },
            { name: "field2", value: { abc: "test", arr: ["c"] } },
          ],
        });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it ignores files in Multipart body", async () => {
  // Enables body parsing
  process.env.NEXT_DEPLOYMENT_ID = "";

  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3436, () => {
      http2Request(
        new URL("http://localhost:3436"),
        "POST",
        {
          "Content-Type":
            "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW",
        },
        '------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalueabc\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="file1"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nThis is the content of the file.\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="field2"\r\n\r\n{"abc": "test", "arr": ["c"]}\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--'
      ).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.body, {
          fields: [
            { name: "field1", value: "valueabc" },
            { name: "field2", value: { abc: "test", arr: ["c"] } },
          ],
        });
        server.close();
        resolve();
      });
    });
  });
});

t.test("invalid Multipart body results in empty body", async () => {
  // Enables body parsing
  process.env.NEXT_DEPLOYMENT_ID = "";

  const server = createMinimalTestServer();

  await new Promise<void>((resolve) => {
    server.listen(3437, () => {
      http2Request(
        new URL("http://localhost:3437"),
        "POST",
        {
          "Content-Type":
            "multipart/form-data; boundary=----WebKitFormBoundaryABCDEFGHIJ",
        },
        '------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalueabc\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="field2"\r\n\r\n{"abc": "test", "arr": ["c"]}\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--'
      ).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context.body, undefined);
        server.close();
        resolve();
      });
    });
  });
});
