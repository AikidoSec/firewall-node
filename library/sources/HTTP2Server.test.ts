import * as t from "tap";
import { Token } from "../agent/api/Token";
import { connect } from "http2";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { HTTPServer } from "./HTTPServer";
import { IncomingHttpHeaders } from "http2";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import { wrap } from "../helpers/wrap";
import * as pkg from "../helpers/isPackageInstalled";

wrap(pkg, "isPackageInstalled", function wrap() {
  return function wrap(name: string) {
    // So that it thinks next is installed
    if (name === "next") {
      return true;
    }
    return false;
  };
});

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
agent.start([new HTTPServer()]);

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

function createMinimalTestServer() {
  const http2 = require("http2");
  const server = http2.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
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
  const http2 = require("http2");
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
