import * as t from "tap";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as http from "node:http";
import * as http2 from "node:http2";
import { getRequestUrl } from "./getRequestUrl";

const fixturesDir = join(__dirname, "../sources/fixtures");

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUST_PROXY;
});

async function getRealRequest(): Promise<http.IncomingMessage> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.statusCode = 200;
      res.end();
      server.close(); // stop server once we have a request
      resolve(req);
    });
    server.listen(0, () => {
      const { port } = server.address() as any;
      // Send a real request to trigger IncomingMessage creation
      http
        .get({ port, path: "/", headers: {} }, (res) => {
          while (res.read()) {
            // consume body to prevent test from not exiting
          }

          t.same(res.statusCode, 200);
        })
        .end();
    });
  });
}

let baseMockRequest: http.IncomingMessage | null = null;

async function createMockRequest(
  overrides: Partial<http.IncomingMessage> = {}
): Promise<http.IncomingMessage> {
  if (!baseMockRequest) {
    baseMockRequest = await getRealRequest();
  }
  return Object.assign(
    Object.create(Object.getPrototypeOf(baseMockRequest)),
    baseMockRequest,
    overrides
  );
}

t.test("already absolute URL", async (t) => {
  t.equal(
    getRequestUrl(await createMockRequest({ url: "http://example.com/path" })),
    "http://example.com/path"
  );

  t.equal(
    getRequestUrl(
      await createMockRequest({ url: "https://example.com/path?test=123" })
    ),
    "https://example.com/path?test=123"
  );
});

t.test("no url set", async (t) => {
  const mockReq = await createMockRequest({ url: undefined });
  t.equal(getRequestUrl(mockReq), `http://${mockReq.headers.host}`);
});

t.test("no url and no host set", async (t) => {
  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: undefined,
        headers: {},
      })
    ),
    ""
  );
});

t.test("no host header", async (t) => {
  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: "/some/path?query=1",
        headers: {},
      })
    ),
    "/some/path?query=1"
  );
});

t.test("relative URL with host header", async (t) => {
  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: "/some/path?query=1",
        headers: { host: "example.com" },
      })
    ),
    "http://example.com/some/path?query=1"
  );
});

t.test("With X-Forwarded-Host header and trust proxy disabled", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "0";

  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: "/forwarded/path",
        headers: {
          host: "original.com",
          "x-forwarded-host": "forwarded.com",
        },
      })
    ),
    "http://original.com/forwarded/path"
  );
});

t.test("With X-Forwarded-Host header and trust proxy enabled", async (t) => {
  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: "/forwarded/path",
        headers: {
          host: "original.com",
          "x-forwarded-host": "forwarded.com",
        },
      })
    ),
    "http://forwarded.com/forwarded/path"
  );
});

t.test("With X-Forwarded-Proto header and trust proxy enabled", async (t) => {
  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: "/secure/path",
        headers: {
          host: "example.com",
          "x-forwarded-proto": "https",
        },
      })
    ),
    "https://example.com/secure/path"
  );
});

t.test("With X-Forwarded-Proto header set to invalid value", async (t) => {
  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: "/weird/path",
        headers: {
          host: "example.com",
          "x-forwarded-proto": "abc",
        },
      })
    ),
    "http://example.com/weird/path"
  );
});

t.test("With X-Forwarded-Proto header and trust proxy disabled", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "0";

  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: "/notrust/path",
        headers: {
          host: "example.com",
          "x-forwarded-proto": "https",
        },
      })
    ),
    "http://example.com/notrust/path"
  );
});

t.test("url does not start with slash and is not absolute", async (t) => {
  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: "noslash/path",
        headers: { host: "example.com" },
      })
    ),
    "http://example.com/noslash/path"
  );
});

t.test("url does not start with http/https but is absolute", async (t) => {
  t.match(
    getRequestUrl(
      await createMockRequest({ url: "ftp://example.com/resource" })
    ),
    /http:\/\/localhost:\d+\/ftp:\/\/example.com\/resource/
  );
});

t.test("detects https from encrypted TLS socket", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "0";

  const mockReq = await createMockRequest({
    url: "/tls/path",
    headers: { host: "example.com" },
  });
  (mockReq as any).socket = { encrypted: true };

  t.equal(getRequestUrl(mockReq), "https://example.com/tls/path");
});

t.test("uses x-forwarded-protocol header", async (t) => {
  t.equal(
    getRequestUrl(
      await createMockRequest({
        url: "/protocol/path",
        headers: {
          host: "example.com",
          "x-forwarded-protocol": "https",
        },
      })
    ),
    "https://example.com/protocol/path"
  );
});

// HTTP/2 compatibility mode tests
async function getRealHttp2Request(
  requestPath: string = "/"
): Promise<http2.Http2ServerRequest> {
  return new Promise((resolve) => {
    const server = http2.createServer((req, res) => {
      res.statusCode = 200;
      res.end();
      server.close();
      resolve(req);
    });
    server.listen(0, () => {
      const { port } = server.address() as any;
      const client = http2.connect(`http://localhost:${port}`);
      const req = client.request({ ":path": requestPath });
      req.on("response", () => {
        req.close();
        client.close();
      });
      req.end();
    });
  });
}

async function getRealSecureHttp2Request(
  requestPath: string = "/"
): Promise<http2.Http2ServerRequest> {
  return new Promise((resolve) => {
    const server = http2.createSecureServer(
      {
        key: readFileSync(join(fixturesDir, "key.pem")),
        cert: readFileSync(join(fixturesDir, "cert.pem")),
      },
      (req, res) => {
        res.statusCode = 200;
        res.end();
        server.close();
        resolve(req);
      }
    );
    server.listen(0, () => {
      const { port } = server.address() as any;
      const client = http2.connect(`https://localhost:${port}`, {
        rejectUnauthorized: false,
      });
      const req = client.request({ ":path": requestPath });
      req.on("response", () => {
        req.close();
        client.close();
      });
      req.end();
    });
  });
}

t.test("Http2ServerRequest uses authority for host", async (t) => {
  const req = await getRealHttp2Request("/http2/path");

  t.match(getRequestUrl(req), /^http:\/\/localhost:\d+\/http2\/path$/);
});

t.test("Http2ServerRequest uses scheme for protocol", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "0";

  const req = await getRealSecureHttp2Request("/secure/path");

  t.match(getRequestUrl(req), /^https:\/\/localhost:\d+\/secure\/path$/);
});
