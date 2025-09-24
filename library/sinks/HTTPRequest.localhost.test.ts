import * as t from "tap";
import { createServer, IncomingMessage, Server } from "http";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { HTTPRequest } from "./HTTPRequest";

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

agent.start([new HTTPRequest()]);

const http = require("http");

const port = 1343;
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

t.test("it does not block request to localhost with same port", (t) => {
  runWithContext(
    createContext({
      url: serverUrl,
      hostHeader: hostHeader,
      body: {},
    }),
    () => {
      // Server doing a request to itself
      // Let's simulate a request to a favicon
      const request = http.request(`${serverUrl}/favicon.ico`);
      request.on("response", (response: IncomingMessage) => {
        // The server should respond with a 200
        // Because we'll allow requests to localhost if it's the same port
        t.same(response.statusCode, 200);
        response.on("data", () => {});
        response.on("end", () => {});
      });
      request.end();
    }
  );

  const errors: Error[] = [];
  process.on("uncaughtException", (error) => {
    errors.push(error);
  });

  setTimeout(() => {
    t.same(errors, []);
    t.end();
  }, 1000);
});

t.test("it blocks requests to other ports", (t) => {
  runWithContext(
    createContext({
      url: `http://localhost:${port + 1}`,
      hostHeader: `localhost:${port + 1}`,
      body: {
        url: `${serverUrl}/favicon.ico`,
      },
    }),
    () => {
      try {
        // Server doing a request to localhost but with a different port
        // This should be blocked
        const request = http.request(`${serverUrl}/favicon.ico`);
        request.on("response", (response: IncomingMessage) => {
          // This should not be called
          t.fail();
          response.on("data", () => {});
          response.on("end", () => {});
        });
        request.end();
      } catch (error) {
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked a server-side request forgery: http.request(...) originating from body.url"
          );
        }
      }
    }
  );

  setTimeout(() => {
    t.end();
  }, 1000);
});

t.after(() => {
  server.close();
});
