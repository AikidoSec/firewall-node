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

// Async needed because `require(...)` is translated to `await import(..)` when running tests in ESM mode
export async function createUndiciTests(undiciPkgName: string, port: number) {
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
      url: `http://localhost:${port}}`,
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

      const {
        request,
        fetch,
        setGlobalDispatcher,
        Agent: UndiciAgent,
      } = require(undiciPkgName) as typeof import("undici-v6");

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
        port: 443,
      });
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
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
        port: 443,
      });
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
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
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request({
        origin: "https://ssrf-redirects.testssandbox.com",
      } as URL);
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request(
        require("url").parse("https://ssrf-redirects.testssandbox.com")
      );
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
      ]);
      agent.getHostnames().clear();

      await request({
        origin: "https://ssrf-redirects.testssandbox.com",
      } as URL);
      t.same(agent.getHostnames().asArray(), [
        { hostname: "ssrf-redirects.testssandbox.com", port: 443, hits: 1 },
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

      await runWithContext(createContext(), async () => {
        await request("https://google.com");

        const error0 = await t.rejects(() => request("http://localhost:9876"));
        if (error0 instanceof Error) {
          // @ts-expect-error Added in Node.js 16.9.0, but because this test is skipped in Node.js 16 because of the lack of fetch, it's fine
          t.same(error0.code, "ECONNREFUSED");
        }

        const error1 = await t.rejects(() =>
          request(`http://localhost:${port}/api/internal`)
        );
        if (error1 instanceof Error) {
          t.same(
            error1.message,
            "Zen has blocked a server-side request forgery: undici.request(...) originating from body.image"
          );
        }

        const events = api
          .getEvents()
          .filter((e) => e.type === "detected_attack");
        t.same(events.length, 1);
        t.same(events[0].attack.metadata, {
          hostname: "localhost",
          port: port.toString(),
        });

        const error2 = await t.rejects(() =>
          request(new URL(`http://localhost:${port}/api/internal`))
        );
        if (error2 instanceof Error) {
          t.same(
            error2.message,
            "Zen has blocked a server-side request forgery: undici.request(...) originating from body.image"
          );
        }
        const error3 = await t.rejects(() =>
          request({
            protocol: "http:",
            hostname: "localhost",
            port: port,
            pathname: "/api/internal",
          })
        );
        if (error3 instanceof Error) {
          t.same(
            error3.message,
            "Zen has blocked a server-side request forgery: undici.request(...) originating from body.image"
          );
        }

        const error4 = await t.rejects(() =>
          fetch([`http://localhost:${port}/api/internal`] as unknown as string)
        );
        if (error4 instanceof Error) {
          t.same(
            error4.message,
            "Zen has blocked a server-side request forgery: undici.fetch(...) originating from body.image"
          );
        }

        const oldUrl = require("url");
        const error5 = t.throws(() =>
          request(oldUrl.parse(`https://localhost:${port}/api/internal`))
        );
        if (error5 instanceof Error) {
          t.same(
            error5.message,
            "Zen has blocked a server-side request forgery: undici.request(...) originating from body.image"
          );
        }
      });

      await runWithContext(
        { ...createContext(), routeParams: { param: "http://0" } },
        async () => {
          const error = await t.rejects(() => request("http://0"));
          if (error instanceof Error) {
            t.same(
              error.message,
              "Zen has blocked a server-side request forgery: undici.request(...) originating from routeParams.param"
            );
          }
        }
      );

      await runWithContext(
        {
          ...createContext(),
          body: {
            image2: [
              "http://example",
              "prefix.thisdomainpointstointernalip.com",
            ],
            image: "http://thisdomainpointstointernalip.com/path",
          },
        },
        async () => {
          const error = await t.rejects(() =>
            request("http://thisdomainpointstointernalip.com")
          );
          if (error instanceof Error) {
            t.same(
              error.message,
              "Zen has blocked a server-side request forgery: undici.[method](...) originating from body.image"
            );
          }

          const error2 = await t.rejects(() =>
            fetch([
              "http://example",
              "prefix.thisdomainpointstointernalip.com",
            ] as unknown as string)
          );
          if (error2 instanceof Error) {
            t.same(
              // @ts-expect-error Type is not defined
              error2.cause.message,
              "Zen has blocked a server-side request forgery: undici.[method](...) originating from body.image2"
            );
          }

          // Ensure the lookup is only called once per hostname
          // Otherwise, it could be vulnerable to TOCTOU
          t.same(calls["thisdomainpointstointernalip.com"], 1);
        }
      );

      await runWithContext(
        {
          ...createContext(),
          body: { serviceHostname: "my-service-hostname" },
        },
        async () => {
          // This should NOT throw an error because my-service-hostname is a service hostname
          const error = await t.rejects(() =>
            request("http://my-service-hostname")
          );
          if (error instanceof Error) {
            // @ts-expect-error Added in Node.js 16.9.0
            t.same(error.code, "ECONNREFUSED");
            // ^ means it tried to connect to the hostname
          } else {
            t.fail("Expected an error to be thrown");
          }
        }
      );

      await runWithContext(
        {
          ...createContext(),
          body: { metadataHost: "metadata" },
        },
        async () => {
          const error = await t.rejects(() => request("http://metadata"));
          if (error instanceof Error) {
            t.same(
              error.message,
              "Zen has blocked a server-side request forgery: undici.[method](...) originating from body.metadataHost"
            );
          } else {
            t.fail("Expected an error to be thrown");
          }
        }
      );

      logger.clear();
      setGlobalDispatcher(new UndiciAgent({}));
      t.same(logger.getMessages(), [
        "undici.setGlobalDispatcher(..) was called, we can't guarantee protection!",
      ]);
    }
  );

  t.after(() => {
    server.close();
  });
}
