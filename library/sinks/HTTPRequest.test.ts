import * as dns from "dns";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as t from "tap";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { wrap } from "../helpers/wrap";
import { HTTPRequest } from "./HTTPRequest";
import { getUrlFromHTTPRequestArgs as getURL } from "./http-request/getUrlFromHTTPRequestArgs";
import { createTestAgent } from "../helpers/createTestAgent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";

const calls: Record<string, number> = {};
wrap(dns, "lookup", function lookup(original) {
  return function lookup() {
    const hostname = arguments[0];

    if (!calls[hostname]) {
      calls[hostname] = 0;
    }

    calls[hostname]++;

    if (
      hostname === "thisdomainpointstointernalip.com" ||
      hostname === "thisdomainpointstointernalip2.com" ||
      hostname === "my-service-hostname" ||
      hostname === "metadata"
    ) {
      return original.apply(
        // @ts-expect-error We don't know the type of `this`
        this,
        ["localhost", ...Array.from(arguments).slice(1)]
      );
    }

    original.apply(
      // @ts-expect-error We don't know the type of `this`
      this,
      arguments
    );
  };
});

function createContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://local.aikido.io",
    query: {},
    headers: {},
    body: {
      image: "http://localhost:4000/api/internal",
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

t.setTimeout(60 * 1000);

const api = new ReportingAPIForTesting();
const agent = createTestAgent({
  token: new Token("123"),
  api,
});
agent.start([new HTTPRequest()]);

const http = require("http") as typeof import("http");
const https = require("https") as typeof import("https");
const oldUrl = require("url");

t.test("it works", (t) => {
  t.same(agent.getHostnames().asArray(), []);

  runWithContext(createContext(), () => {
    const aikido = http.request("http://aikido.dev");
    aikido.end();
  });

  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 80, hits: 1 },
  ]);
  agent.getHostnames().clear();

  runWithContext(createContext(), () => {
    const aikido = https.request("https://AIKIDO.dev");
    aikido.end();
  });
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
  ]);
  agent.getHostnames().clear();

  const aikido = https.request(new URL("https://aikido.dev"));
  aikido.end();
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
  ]);
  agent.getHostnames().clear();

  const withoutPort = https.request({
    hostname: "aikido.dev",
    port: undefined,
  });
  t.same(withoutPort instanceof http.ClientRequest, true);
  withoutPort.end();
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
  ]);
  agent.getHostnames().clear();

  const httpWithoutPort = http.request({
    hostname: "aikido.dev",
    port: undefined,
  });
  httpWithoutPort.end();
  t.same(httpWithoutPort instanceof http.ClientRequest, true);
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 80, hits: 1 },
  ]);
  agent.getHostnames().clear();

  const withPort = https.request({ hostname: "aikido.dev", port: 443 });
  t.same(withPort instanceof http.ClientRequest, true);
  withPort.end();
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
  ]);
  agent.getHostnames().clear();

  const withStringPort = https.request({ hostname: "aikido.dev", port: "443" });
  t.same(withStringPort instanceof http.ClientRequest, true);
  withStringPort.end();
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
  ]);
  agent.getHostnames().clear();

  t.throws(() => https.request(""));
  t.throws(() => https.request("invalid url"));
  t.same(agent.getHostnames().asArray(), []);
  agent.getHostnames().clear();

  runWithContext(
    {
      ...createContext(),
      body: { image: "thisdomainpointstointernalip.com" },
    },
    () => {
      https
        .request("https://thisdomainpointstointernalip.com")
        .on("error", (error) => {
          t.match(
            error.message,
            "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
          );

          // Ensure the lookup is only called once per hostname
          // Otherwise, it could be vulnerable to TOCTOU
          t.same(calls["thisdomainpointstointernalip.com"], 1);

          t.match(api.getEvents()[api.getEvents().length - 1], {
            type: "detected_attack",
            attack: {
              kind: "ssrf",
              payload: "thisdomainpointstointernalip.com",
              metadata: {
                hostname: "thisdomainpointstointernalip.com",
                port: "443",
                privateIP: getMajorNodeVersion() >= 18 ? "::1" : "127.0.0.1",
              },
            },
          });
        })
        .on("finish", () => {
          t.fail("should not finish");
        })
        .end();
    }
  );

  runWithContext(
    {
      ...createContext(),
      body: { image: "thisdomainpointstointernalip2.com" },
    },
    () => {
      https
        .request("https://thisdomainpointstointernalip2.com", (res) => {
          t.fail("should not respond");
        })
        .on("error", (error) => {
          t.match(
            error.message,
            "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
          );
        })
        .on("finish", () => {
          t.fail("should not finish");
        })
        .end();
    }
  );

  runWithContext(createContext(), () => {
    // With lookup function specified
    const google = http.request("http://google.com", { lookup: dns.lookup });
    google.end();

    // With options object
    const google2 = http.get("http://google.com", {});
    google2.end();
  });

  runWithContext(createContext(), () => {
    // Safe request
    const google = https.request("https://www.google.com");
    google.end();

    // With string URL
    https
      .request("https://localhost:4000/api/internal")
      .on("error", (error) => {
        t.match(
          error.message,
          "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
        );
      })
      .on("finish", () => {
        t.fail("should not finish");
      })
      .end();

    // With URL object
    https
      .request(new URL("https://localhost:4000/api/internal"))
      .on("error", (error) => {
        t.match(
          error.message,
          "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
        );
      })
      .on("finish", () => {
        t.fail("should not finish");
      })
      .end();

    // With object like URL
    https
      .request({
        protocol: "https:",
        hostname: "localhost",
        port: 4000,
        path: "/api/internal",
      })
      .on("error", (error) => {
        t.match(
          error.message,
          "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
        );
      })
      .on("finish", () => {
        t.fail("should not finish");
      })
      .end();

    // Using .get
    https
      .get("https://localhost:4000/api/internal")
      .on("error", (error) => {
        t.match(
          error.message,
          "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
        );
      })
      .on("finish", () => {
        t.fail("should not finish");
      })
      .end();

    // ECONNREFUSED means that the request is not blocked
    http
      .request("http://localhost:9876")
      .on("error", (e: NodeJS.ErrnoException) => {
        t.same(e.code, "ECONNREFUSED");
      });

    https
      .request("https://localhost:9876")
      .on("error", (e: NodeJS.ErrnoException) => {
        t.same(e.code, "ECONNREFUSED");
      });

    https
      .request("https://localhost/api/internal", { port: 9876 })
      .on("error", (e: NodeJS.ErrnoException) => {
        t.same(e.code, "ECONNREFUSED");
      });

    https
      .request("https://localhost/api/internal", { defaultPort: 9876 })
      .on("error", (e: NodeJS.ErrnoException) => {
        t.same(e.code, "ECONNREFUSED");
      });

    http
      .request({ defaultPort: 4000, path: "/api/internal" })
      .on("error", (error) => {
        t.match(
          error.message,
          "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
        );
      })
      .on("finish", () => {
        t.fail("should not finish");
      })
      .end();

    http
      .request({ defaultPort: 9876 })
      .on("error", (e: NodeJS.ErrnoException) => {
        t.same(e.code, "ECONNREFUSED");
      });

    // With options object at index 1
    https
      .request({
        protocol: "https:",
        hostname: "localhost",
        port: 4000,
        path: "/api/internal",
      })
      .on("error", (error) => {
        t.match(
          error.message,
          "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
        );
      })
      .on("finish", () => {
        t.fail("should not finish");
      })
      .end();

    https
      .request(oldUrl.parse("https://localhost:4000/api/internal"))
      .on("error", (error) => {
        t.match(
          error.message,
          "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
        );
      })
      .on("finish", () => {
        t.fail("should not finish");
      })
      .end();
  });

  runWithContext(
    {
      ...createContext(),
      body: { serviceHostname: "my-service-hostname" },
    },
    () => {
      // This should NOT throw an error because my-service-hostname is a service hostname
      const serviceRequest = http.request("http://my-service-hostname");
      serviceRequest.on("error", (e: NodeJS.ErrnoException) => {
        // ECONNREFUSED means that the request is not blocked
        t.same(e.code, "ECONNREFUSED");
      });
      serviceRequest.end();
    }
  );

  runWithContext(
    {
      ...createContext(),
      body: { metadataHost: "metadata" },
    },
    () => {
      const metadataRequest = http.request(
        "http://metadata/computeMetadata/v1/instance/"
      );
      metadataRequest.on("error", (e: NodeJS.ErrnoException) => {
        t.same(
          e.message,
          "Zen has blocked a server-side request forgery: http.request(...) originating from body.metadataHost"
        );
      });
      metadataRequest.on("finish", () => {
        t.fail("should not finish");
      });
      metadataRequest.end();
    }
  );

  runWithContext(
    {
      ...createContext(),
      body: { path: "/tmp/unixsocket" },
    },
    () => {
      try {
        https
          .request(
            {
              socketPath: "/tmp/unixsocket",
            },
            (res) => {
              t.fail("should not respond");
            }
          )
          .on("finish", () => {
            t.fail("should not finish");
          })
          .end();
      } catch (error) {
        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen has blocked a path traversal attack: https.request(...) originating from body.path"
          );
        }
      }
    }
  );

  agent.getHostnames().clear();
  agent.getConfig().updateDomains([
    { hostname: "aikido.dev", mode: "block" },
    { hostname: "app.aikido.dev", mode: "allow" },
  ]);

  const blockedError1 = t.throws(() =>
    https.request("https://aikido.dev/block")
  );
  if (blockedError1 instanceof Error) {
    t.same(
      blockedError1.message,
      "Zen has blocked an outbound connection: https.request(...) to aikido.dev"
    );
  }

  const notBlocked1 = https.request("https://app.aikido.dev");
  notBlocked1.end();

  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
    { hostname: "app.aikido.dev", port: 443, hits: 1 },
  ]);

  agent.getConfig().setBlockNewOutgoingRequests(true);

  const blockedError2 = t.throws(() => https.request("https://example.com"));
  if (blockedError2 instanceof Error) {
    t.same(
      blockedError2.message,
      "Zen has blocked an outbound connection: https.request(...) to example.com"
    );
  }

  const notBlocked2 = https.request("https://app.aikido.dev");
  notBlocked2.end();

  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
    { hostname: "app.aikido.dev", port: 443, hits: 2 },
    { hostname: "example.com", port: 443, hits: 1 },
  ]);

  setTimeout(() => {
    t.end();
  }, 3000);
});

t.test("node.js applies defaults for empty or missing options", async (t) => {
  function createRequest(
    module: "http" | "https",
    options: http.RequestOptions
  ) {
    const req = (module === "http" ? http : https).request(options);
    req.on("error", () => {});
    req.destroy();
    return req;
  }

  for (const module of ["http", "https"] as const) {
    const protocol = `${module}:`;

    t.same(
      createRequest(module, { protocol: "", hostname: "127.0.0.1" }).protocol,
      protocol
    );
    t.same(
      createRequest(module, { hostname: "", host: "127.0.0.1" }).host,
      "127.0.0.1"
    );
    t.same(createRequest(module, { port: 2375 }).host, "localhost");
    t.same(createRequest(module, { hostname: "", host: "" }).host, "localhost");
    t.same(
      createRequest(module, { hostname: "127.0.0.1", port: "" }).getHeader(
        "host"
      ),
      "127.0.0.1"
    );
    t.same(
      createRequest(module, { hostname: "127.0.0.1", path: "" }).path,
      "/"
    );
  }
});

t.test(
  "node.js uses socketPath instead of host and port",
  { skip: process.platform === "win32" ? "unix sockets" : false },
  async (t) => {
    const dir = mkdtempSync(join(tmpdir(), "zen-socketpath-"));
    const socketPath = join(dir, "test.sock");
    let tcpHits = 0;
    let socketHits = 0;

    const tcpServer = http.createServer((req, res) => {
      tcpHits++;
      res.end("tcp");
    });
    const socketServer = http.createServer((req, res) => {
      socketHits++;
      res.end("socket");
    });

    t.teardown(() => {
      tcpServer.close();
      socketServer.close();
      rmSync(dir, { recursive: true, force: true });
    });

    await new Promise<void>((resolve) =>
      tcpServer.listen(0, "127.0.0.1", resolve)
    );
    await new Promise<void>((resolve) =>
      socketServer.listen(socketPath, resolve)
    );
    const address = tcpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP address");
    }

    const body = await new Promise<string>((resolve, reject) => {
      http
        .request(
          {
            socketPath,
            host: "127.0.0.1",
            hostname: "127.0.0.1",
            port: address.port,
            path: "/",
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
          }
        )
        .on("error", reject)
        .end();
    });

    t.same(body, "socket");
    t.same(socketHits, 1);
    t.same(tcpHits, 0);
  }
);

t.test("node.js prefers the url port over defaultPort", async (t) => {
  function getHost(args: [string, http.RequestOptions]) {
    const req = http.request(...args);
    req.on("error", () => {});
    req.destroy();
    return req.getHeader("host");
  }

  const cases: [string, http.RequestOptions, string][] = [
    ["http://127.0.0.1:3000/", { defaultPort: 2375 }, "127.0.0.1:3000"],
    [
      "http://127.0.0.1:3000/",
      { port: 4000, defaultPort: 2375 },
      "127.0.0.1:4000",
    ],
  ];

  for (const [url, options, host] of cases) {
    t.same(getHost([url, options]), host);
    t.same(getURL([url, options], "http")?.host, host);
  }
});
