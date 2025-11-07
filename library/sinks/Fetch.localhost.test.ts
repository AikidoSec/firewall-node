import * as t from "tap";
import { createServer, Server } from "http";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { Fetch } from "./Fetch";

// Fetch tests are split up because sockets are re-used for the same hostname
// See Fetch.localhost.test.ts and Fetch.localhost2.test.ts

function createContext({
  url,
  hostHeader,
  body,
  additionalHeaders = {},
}: {
  url: string;
  hostHeader: string;
  body: unknown;
  additionalHeaders?: Record<string, string>;
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
      ...additionalHeaders,
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

agent.start([new Fetch()]);

const port = 1341;
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
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    await runWithContext(
      createContext({
        url: serverUrl,
        hostHeader: hostHeader,
        body: {},
      }),
      async () => {
        // Server doing a request to itself
        const response = await fetch(`${serverUrl}/favicon.ico`);
        // The server should respond with a 200
        t.same(response.status, 200);
      }
    );
  }
);

t.test(
  "it does not block request to localhost with same port using the origin header",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    await runWithContext(
      createContext({
        url: serverUrl,
        hostHeader: "",
        body: {},
        additionalHeaders: {
          origin: serverUrl,
        },
      }),
      async () => {
        // Server doing a request to itself
        const response = await fetch(`${serverUrl}/favicon.ico`);
        // The server should respond with a 200
        t.same(response.status, 200);
      }
    );
  }
);

t.test(
  "it does not block request to localhost with same port using the referer header",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    await runWithContext(
      createContext({
        url: serverUrl,
        hostHeader: "",
        body: {},
        additionalHeaders: {
          referer: serverUrl,
        },
      }),
      async () => {
        // Server doing a request to itself
        const response = await fetch(`${serverUrl}/favicon.ico`);
        // The server should respond with a 200
        t.same(response.status, 200);
      }
    );
  }
);

t.after(() => {
  server.close();
});
