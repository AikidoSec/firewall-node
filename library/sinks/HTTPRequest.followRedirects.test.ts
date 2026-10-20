import * as t from "tap";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { HTTPRequest } from "./HTTPRequest";
import { createTestAgent } from "../helpers/createTestAgent";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
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

let server: import("http").Server;
const port = 3000;

t.before(async () => {
  const { createServer } = require("http") as typeof import("http");

  server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello World\n");
  });

  server.unref();

  return new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });
});

const redirectTestUrl = "http://ssrf-redirects.testssandbox.com";

const agent = createTestAgent({
  token: new Token("123"),
});
agent.start([new HTTPRequest()]);

const { http } =
  require("follow-redirects") as typeof import("follow-redirects");

t.test("it works", { skip: "SSRF redirect check disabled atm" }, (t) => {
  runWithContext(
    {
      ...context,
      // Redirects to http://127.0.0.1/test
      body: { image: `${redirectTestUrl}/ssrf-test` },
    },
    () => {
      const response = http.request(`${redirectTestUrl}/ssrf-test`, () => {
        t.fail("should not respond");
      });
      response.on("error", (e) => {
        t.ok(e instanceof Error);
        t.same(
          e.message,
          "Redirected request failed: Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
        );
      });
      response.end();
    }
  );

  runWithContext(
    {
      ...context,
      // Redirects to http://local.aikido.io/test
      body: { image: `${redirectTestUrl}/ssrf-test-domain` },
    },
    () => {
      const response = http.request(
        `${redirectTestUrl}/ssrf-test-domain`,
        (res) => {
          t.fail("should not respond");
        }
      );
      response.on("error", (e) => {
        t.ok(e instanceof Error);
        t.same(
          e.message,
          "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
        );
      });
      response.end();
    }
  );

  runWithContext(
    {
      ...context,
      // Redirects to http://[::1]/test
      body: { image: `${redirectTestUrl}/ssrf-test-ipv6` },
    },
    () => {
      const response = http.request(`${redirectTestUrl}/ssrf-test-ipv6`, () => {
        t.fail("should not respond");
      });
      response.on("error", (e) => {
        t.ok(e instanceof Error);
        t.same(
          e.message,
          "Redirected request failed: Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
        );
      });
      response.end();
    }
  );

  runWithContext(
    {
      ...context,
    },
    () => {
      const response = http.request(`http://[::]:${port}`, (res) => {
        while (res.read()) {
          // consume body
        }

        t.same(res.statusCode, 200);
      });
      response.end();
    }
  );

  setTimeout(() => {
    t.end();
  }, 3000);
});

t.after(async () => {
  return new Promise((resolve) => {
    server.close(resolve);
  });
});
