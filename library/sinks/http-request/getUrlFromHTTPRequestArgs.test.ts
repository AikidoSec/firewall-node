import * as t from "tap";
import * as http from "http";
import * as https from "https";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getUrlFromHTTPRequestArgs as getURL } from "./getUrlFromHTTPRequestArgs";

t.test("it works with strings", async (t) => {
  t.same(
    getURL(["http://localhost:4000"], "http"),
    new URL("http://localhost:4000")
  );
  t.same(getURL(["http://localhost"], "http"), new URL("http://localhost"));
  t.same(getURL(["https://localhost"], "https"), new URL("https://localhost"));
  t.same(getURL(["ftp://localhost"], "http"), new URL("ftp://localhost"));
});

t.test("it works with URLs", async (t) => {
  t.same(
    getURL([new URL("http://localhost:4000")], "http"),
    new URL("http://localhost:4000")
  );
  t.same(
    getURL([new URL("http://localhost")], "http"),
    new URL("http://localhost")
  );
  t.same(
    getURL([new URL("https://localhost")], "https"),
    new URL("https://localhost")
  );
  t.same(
    getURL([new URL("ftp://localhost")], "http"),
    new URL("ftp://localhost")
  );
});

t.test("it works with options", async (t) => {
  t.same(
    getURL(["http://localhost:4000", { protocol: "https:" }], "http"),
    new URL("https://localhost:4000")
  );
  t.same(
    getURL(["https://localhost:4000", { hostname: "test.dev" }], "https"),
    new URL("https://test.dev:4000")
  );
  t.same(
    getURL([new URL("http://localhost:4000"), { port: 3000 }], "http"),
    new URL("http://localhost:3000")
  );
  t.same(
    getURL(
      [new URL("http://localhost:4000"), { port: 3000, path: "/test?q=1" }],
      "http"
    ),
    new URL("http://localhost:3000/test?q=1")
  );
});

t.test("it wraps host and hostname with square brackets", async (t) => {
  t.same(
    getURL([{ protocol: "http:", host: "::", port: 80 }], "http")?.href,
    new URL("http://[::]:80").href
  );
  t.same(
    getURL([{ protocol: "http:", hostname: "::", port: 80 }], "http")?.href,
    new URL("http://[::]:80").href
  );
  t.same(
    getURL([new URL("http://domain.com"), { hostname: "::" }], "http")?.href,
    new URL("http://[::]:80").href
  );
  t.same(
    getURL([new URL("http://domain.com"), { host: "::" }], "http")?.href,
    new URL("http://[::]:80").href
  );
  t.same(
    getURL([new URL("http://[::]")], "http")?.href,
    new URL("http://[::]:80").href
  );
});

t.test("it does not throw on invalid arguments", async (t) => {
  t.same(getURL([], "http"), undefined);
  // @ts-expect-error Test
  t.same(getURL(["%test%"], undefined), undefined);
});

t.test("it works without url and only options", async (t) => {
  t.same(
    getURL([{ protocol: "https:", hostname: "localhost", port: 4000 }], "http"),
    new URL("https://localhost:4000")
  );
  t.same(
    getURL([{ hostname: "localhost", port: 4000 }], "http"),
    new URL("http://localhost:4000")
  );
  t.same(
    getURL([{ protocol: "https:", hostname: "localhost" }], "http"),
    new URL("https://localhost")
  );
  t.same(
    getURL([{ hostname: "localhost", path: "/test" }], "http"),
    new URL("http://localhost/test")
  );
  t.same(
    getURL([{ hostname: "localhost", path: "/test?q=1" }], "https"),
    new URL("https://localhost/test?q=1")
  );
});

t.test("it uses node's defaults for empty or missing options", async (t) => {
  t.same(
    getURL([{ protocol: "", hostname: "127.0.0.1", path: "/" }], "http")?.href,
    "http://127.0.0.1/"
  );
  t.same(
    getURL([{ protocol: "", hostname: "127.0.0.1", path: "/" }], "https")?.href,
    "https://127.0.0.1/"
  );
  t.same(
    getURL([{ hostname: "", host: "127.0.0.1", path: "/" }], "http")?.href,
    "http://127.0.0.1/"
  );
  t.same(
    getURL([{ port: 2375, path: "/" }], "http")?.href,
    "http://localhost:2375/"
  );
  t.same(
    getURL([{ hostname: "", host: "", port: 2375, path: "/" }], "http")?.href,
    "http://localhost:2375/"
  );
  t.same(getURL([{ path: "/" }], "https")?.href, "https://localhost/");
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

t.test("Do not get port 0 from request options", async (t) => {
  t.same(
    getURL([{ protocol: "https:", hostname: "localhost", port: 0 }], "http"),
    new URL("https://localhost")
  );
  t.same(
    getURL([{ hostname: "localhost", port: 0 }], "http"),
    new URL("http://localhost")
  );
  t.same(
    getURL([{ protocol: "https:", hostname: "localhost", port: 0 }], "https"),
    new URL("https://localhost")
  );
  t.same(
    getURL([{ hostname: "localhost", port: 0 }], "https"),
    new URL("https://localhost")
  );
});

t.test("Pass port as string", async (t) => {
  t.same(
    getURL(
      [{ protocol: "https:", hostname: "localhost", port: "4000" }],
      "https"
    ),
    new URL("https://localhost:4000")
  );
  t.same(
    getURL(["https://localhost", { port: "4000" }], "https"),
    new URL("https://localhost:4000")
  );
});

t.test("Pass host instead of hostname", async (t) => {
  t.same(
    getURL([{ protocol: "https:", host: "localhost:4000" }], "https"),
    new URL("https://localhost:4000")
  );
  t.same(
    getURL(["https://localhost", { host: "test.dev" }], "https"),
    new URL("https://test.dev")
  );
});

t.test("it works with node:url object as first argument", async (t) => {
  const oldUrl = require("url");

  t.same(
    getURL([oldUrl.parse("http://localhost:4000")], "http"),
    new URL("http://localhost:4000")
  );
});

t.test("it uses defaultPort when port is not set", async (t) => {
  t.same(
    getURL([{ defaultPort: 2375 }], "http"),
    new URL("http://localhost:2375")
  );
  t.same(
    getURL([{ hostname: "localhost", defaultPort: "2375" }], "http"),
    new URL("http://localhost:2375")
  );
  t.same(
    getURL([{ defaultPort: 2375, path: "/containers/json" }], "http"),
    new URL("http://localhost:2375/containers/json")
  );
  // port takes precedence over defaultPort
  t.same(
    getURL([{ port: 3000, defaultPort: 2375 }], "http"),
    new URL("http://localhost:3000")
  );
  // Merged with a url argument
  t.same(
    getURL(["http://example.com", { defaultPort: 2375 }], "http"),
    new URL("http://example.com:2375")
  );
  // Explicit port in the url takes precedence over defaultPort
  t.same(
    getURL(["http://example.com:3000", { defaultPort: 2375 }], "http"),
    new URL("http://example.com:3000")
  );
  // options.port still takes precedence over the url port
  t.same(
    getURL(
      ["http://example.com:3000", { port: 4000, defaultPort: 2375 }],
      "http"
    ),
    new URL("http://example.com:4000")
  );
});

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

t.test("a path cannot inject a URL authority", async (t) => {
  t.same(
    getURL([{ hostname: "127.0.0.1", path: "@public.example/" }], "http")
      ?.hostname,
    "127.0.0.1"
  );
  t.same(
    getURL(
      [
        "http://example.com/",
        { hostname: "127.0.0.1", path: "@public.example/" },
      ],
      "http"
    )?.hostname,
    "127.0.0.1"
  );
});
