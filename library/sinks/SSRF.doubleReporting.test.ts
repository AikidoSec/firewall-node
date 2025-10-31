import * as t from "tap";
import { setTimeout } from "timers/promises";
import type { Server } from "http";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { startTestAgent } from "../helpers/startTestAgent";
import { HTTPRequest } from "./HTTPRequest";
import { Fetch } from "./Fetch";
import { Undici } from "./Undici";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";

function createContext(port: number): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: `http://acme.com/api/internal`,
    query: {},
    headers: {},
    body: {
      image: `http://localhost:${port}`,
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/api/internal",
  };
}

const port = 1344;
const serverUrl = `http://localhost:${port}`;

const api = new ReportingAPIForTesting();
startTestAgent({
  token: new Token("123"),
  api,
  block: false, // Detection mode only
  wrappers: [new HTTPRequest(), new Fetch(), new Undici()],
  rewrite: { undici: "undici-v6" },
});

let server: Server;
t.before(async () => {
  const { createServer } = require("http") as typeof import("http");
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
  "it reports SSRF attack only once in detection mode for localhost",
  async (t) => {
    const http = require("http") as typeof import("http");

    await new Promise<void>((resolve) => {
      runWithContext(createContext(port), () => {
        const request = http.request(serverUrl);
        request.on("response", () => {
          resolve();
        });
        request.on("error", () => {
          t.fail("Request should not error in detection mode");
          resolve();
        });
        request.end();
      });
    });

    await setTimeout(100);

    let events = api.getEvents();
    let attackEvents = events.filter((e) => e.type === "detected_attack");
    t.same(
      attackEvents.length,
      1,
      "http.request should report attack exactly once"
    );

    api.clear();

    // ReadableStream is not available in Node.js 16 and below
    if (getMajorNodeVersion() > 16) {
      await runWithContext(createContext(port), async () => {
        const response = await fetch(serverUrl);
        t.same(response.status, 200);
      });

      await setTimeout(100);

      events = api.getEvents();
      attackEvents = events.filter((e) => e.type === "detected_attack");
      t.same(attackEvents.length, 1, "fetch should report attack exactly once");

      api.clear();

      const undici = require("undici-v6") as typeof import("undici-v6");
      await runWithContext(createContext(port), async () => {
        const response = await undici.request(serverUrl);
        t.same(response.statusCode, 200);
      });

      await setTimeout(100);

      events = api.getEvents();
      attackEvents = events.filter((e) => e.type === "detected_attack");
      t.same(
        attackEvents.length,
        1,
        "undici.request should report attack exactly once"
      );
    }
  }
);

t.after(() => {
  server.close();
});
