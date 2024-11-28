/* eslint-disable prefer-rest-params */
import * as t from "tap";
import { createServer, Server } from "http";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { __internalRewritePackageName } from "../agent/hooks/wrapRequire";
import { createTestAgent } from "../helpers/createTestAgent";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { Undici } from "./Undici";

function createContext({
  url,
  hostHeader,
  body,
}: {
  url: string;
  hostHeader: string;
  body: unknown;
}): Context {
  return {
    url: url,
    method: "GET",
    headers: {
      host: hostHeader,
      connection: "keep-alive",
      "cache-control": "max-age=0",
      "sec-ch-ua":
        '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "sec-fetch-site": "none",
      "sec-fetch-mode": "navigate",
      "sec-fetch-user": "?1",
      "sec-fetch-dest": "document",
      "accept-encoding": "gzip, deflate, br, zstd",
      "accept-language": "nl,en;q=0.9,en-US;q=0.8",
    },
    route: "/",
    query: {},
    source: "express",
    routeParams: {},
    cookies: {},
    remoteAddress: "127.0.0.1",
    subdomains: [],
    body: body,
  };
}

const agent = createTestAgent({
  token: new Token("123"),
});

agent.start([new Undici()]);
__internalRewritePackageName("undici", "undici-v6");

const port = 1346;
const serverUrl = `http://localhost:${port}`;
const hostHeader = `localhost:${port}`;

let server: Server;
t.before(async () => {
  server = createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello World\n");
  });

  return new Promise<void>((resolve) => {
    server.listen(port, resolve);
    server.unref();
  });
});

t.test(
  "it does not block request to localhost with same port",
  {
    skip:
      getMajorNodeVersion() <= 16 ? "ReadableStream is not available" : false,
  },
  async (t) => {
    const { request } = require("undici-v6") as typeof import("undici-v6");

    await runWithContext(
      createContext({
        url: serverUrl,
        hostHeader: hostHeader,
        body: {},
      }),
      async () => {
        // Server doing a request to itself
        const response = await request(`${serverUrl}/favicon.ico`);
        // The server should respond with a 200
        t.same(response.statusCode, 200);
      }
    );
  }
);

t.test(
  "it blocks requests to other ports",
  {
    skip:
      getMajorNodeVersion() <= 16 ? "ReadableStream is not available" : false,
  },
  async (t) => {
    const { request } = require("undici-v6") as typeof import("undici-v6");

    const error = await t.rejects(async () => {
      await runWithContext(
        createContext({
          url: `http://localhost:${port + 1}`,
          hostHeader: `localhost:${port + 1}`,
          body: {
            url: `${serverUrl}/favicon.ico`,
          },
        }),
        async () => {
          // Server doing a request to localhost but with a different port
          // This should be blocked
          await request(`${serverUrl}/favicon.ico`);
          // This should not be called
          t.fail();
        }
      );
    });

    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.same(
        error.message,
        "Zen has blocked a server-side request forgery: undici.request(...) originating from body.url"
      );
    }
  }
);

t.after(() => {
  server.close();
});
