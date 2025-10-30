/* eslint-disable prefer-rest-params */
import * as dns from "dns";
import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { LoggerForTesting } from "../agent/logger/LoggerForTesting";
import { startTestAgent } from "../helpers/startTestAgent";
import { wrap } from "../helpers/wrap";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { Undici } from "./Undici";

// Undici tests are split up because sockets are re-used for the same hostname
// See Undici.tests.ts and Undici2.tests.ts
export function createUndiciTests(undiciPkgName: string, port: number) {
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
        hostname === "my-service-hostname" ||
        hostname === "metadata"
      ) {
        return original.apply(
          // @ts-expect-error We don't know the type of `this`
          this,
          ["localhost", ...Array.from(arguments).slice(1)]
        );
      }

      if (hostname === "example,prefix.thisdomainpointstointernalip.com") {
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

  let server: ReturnType<typeof import("http").createServer>;
  t.before(() => {
    const http = require("http") as typeof import("http");
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

      const { request, fetch } = require(
        undiciPkgName
      ) as typeof import("undici-v6");

      await request("https://ssrf-redirects.testssandbox.com");
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
      ]);
      agent.getHostnames().clear();

      await fetch("https://ssrf-redirects.testssandbox.com");
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "https:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: 443,
      });
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "https:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: "443",
      });
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: "443", hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "https:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: undefined,
      });
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "http:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: undefined,
      });
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 80, hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request({
        protocol: "https:",
        hostname: "ssrf-redirects.testssandbox.com",
        port: "443",
      });
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: "443", hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request(new URL("https://ssrf-redirects.testssandbox.com"));
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request(
        require("url").parse("https://ssrf-redirects.testssandbox.com")
      );
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: "443", hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request({
        origin: "https://ssrf-redirects.testssandbox.com",
      } as URL);
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: "443", hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request(
        require("url").parse("https://ssrf-redirects.testssandbox.com")
      );
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: "443", hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request({
        origin: "https://ssrf-redirects.testssandbox.com",
      } as URL);
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: "443", hits: 1 },
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
    }
  );

  t.after(() => {
    server.close();
  });
}
