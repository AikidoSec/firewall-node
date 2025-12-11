import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { LoggerForTesting } from "../agent/logger/LoggerForTesting";
import { startTestAgent } from "../helpers/startTestAgent";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { Undici } from "./Undici";

// Undici tests are split up because sockets are re-used for the same hostname
// See Undici.tests.ts and Undici2.tests.ts
// Async needed because `require(...)` is translated to `await import(..)` when running tests in ESM mode
export async function createUndiciTests(undiciPkgName: string, port: number) {
  function createContext(): Context {
    return {
      remoteAddress: "::1",
      method: "POST",
      url: "acme.com",
      query: {},
      headers: {},
      body: {
        image: `http://localhost:${port}/api/internal`,
      },
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/posts/:id",
    };
  }

  const http = require("http") as typeof import("http");

  let server: ReturnType<typeof import("http").createServer>;
  t.before(() => {
    server = http.createServer((req, res) => {
      res.end("Hello, world!");
    });
    server.unref();
    server.listen(port);
  });

  t.test(
    "it works",
    {
      skip:
        getMajorNodeVersion() <= 16 ? "ReadableStream is not available" : false,
    },
    async (t) => {
      const logger = new LoggerForTesting();
      const api = new ReportingAPIForTesting({
        success: true,
        endpoints: [],
        configUpdatedAt: 0,
        heartbeatIntervalInMS: 10 * 60 * 1000,
        blockedUserIds: [],
        allowedIPAddresses: ["1.2.3.4"],
        block: true,
        receivedAnyStats: false,
      });
      const agent = startTestAgent({
        api,
        logger,
        token: new Token("123"),
        wrappers: [new Undici()],
        rewrite: {
          undici: undiciPkgName,
        },
      });

      const { request, fetch, Client, Agent } = require(
        undiciPkgName
      ) as typeof import("undici-v6");

      await request("https://ssrf-redirects.testssandbox.com");

      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await fetch("https://ssrf-redirects.testssandbox.com");
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "https:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: 443,
      });
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "https:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: 443,
      });
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "https:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: undefined,
      });
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "http:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: undefined,
      });
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 80,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "https:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: 443,
      });
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request(new URL("https://ssrf-redirects.testssandbox.com"));
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request(
        require("url").parse("https://ssrf-redirects.testssandbox.com")
      );
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request({
        origin: "https://ssrf-redirects.testssandbox.com",
      } as URL);
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request(
        require("url").parse("https://ssrf-redirects.testssandbox.com")
      );
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await request({
        origin: "https://ssrf-redirects.testssandbox.com",
      } as URL);
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "ssrf-redirects.testssandbox.com",
          port: 443,
          hits: 1,
        },
      ]);
      agent.getHostnames().clear();

      await t.rejects(() => request("invalid url"));
      await t.rejects(() => request({ hostname: "" }));

      await runWithContext(
        {
          ...createContext(),
          remoteAddress: "1.2.3.4",
        },
        async () => {
          // Bypass the block using an allowed IP
          await request(`http://localhost:${port}/api/internal`);
        }
      );

      agent.getHostnames().clear();

      const client = new Client(`http://localhost:${port}`);
      await client.request({
        path: "/api/test",
        method: "GET",
      });
      await client.request({
        path: "/api/test2",
        method: "GET",
      });
      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "localhost",
          port: port,
          hits: 2,
        },
      ]);

      agent.getHostnames().clear();

      const undiciAgent = new Agent();
      await undiciAgent.request({
        origin: `http://localhost:${port}`,
        path: "/api/test",
        method: "GET",
      });
      await undiciAgent.request({
        origin: new URL(`http://localhost:${port}`),
        path: "/api/test",
        method: "GET",
      });

      t.same(agent.getHostnames().asArray(), [
        {
          hostname: "localhost",
          port: port,
          hits: 2,
        },
      ]);
    }
  );

  t.after(() => {
    server.close();
  });
}
