/* eslint-disable prefer-rest-params */
import * as dns from "dns";
import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { LoggerForTesting } from "../agent/logger/LoggerForTesting";
import { wrap } from "../helpers/wrap";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { Undici } from "./Undici";

const calls: Record<string, number> = {};
wrap(dns, "lookup", function lookup(original) {
  return function lookup() {
    const hostname = arguments[0];

    if (!calls[hostname]) {
      calls[hostname] = 0;
    }

    calls[hostname]++;

    if (hostname === "thisdomainpointstointernalip.com") {
      return original.apply(this, [
        "localhost",
        ...Array.from(arguments).slice(1),
      ]);
    }

    if (hostname === "example,prefix.thisdomainpointstointernalip.com") {
      return original.apply(this, [
        "localhost",
        ...Array.from(arguments).slice(1),
      ]);
    }

    original.apply(this, arguments);
  };
});

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

t.test(
  "it works",
  {
    skip:
      getMajorNodeVersion() <= 16 ? "ReadableStream is not available" : false,
  },
  async (t) => {
    const logger = new LoggerForTesting();
    const agent = new Agent(
      true,
      logger,
      new ReportingAPIForTesting(),
      new Token("123"),
      undefined
    );

    agent.start([new Undici()]);

    const {
      request,
      fetch,
      setGlobalDispatcher,
      Agent: UndiciAgent,
    } = require("undici");

    await request("https://aikido.dev");
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await fetch("https://aikido.dev");
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await request({ protocol: "https:", hostname: "aikido.dev", port: 443 });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await request({ protocol: "https:", hostname: "aikido.dev", port: "443" });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: "443" },
    ]);
    agent.getHostnames().clear();

    await request({
      protocol: "https:",
      hostname: "aikido.dev",
      port: undefined,
    });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await request({
      protocol: "http:",
      hostname: "aikido.dev",
      port: undefined,
    });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 80 },
    ]);
    agent.getHostnames().clear();

    await request({
      protocol: "https:",
      hostname: "aikido.dev",
      port: "443",
    });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: "443" },
    ]);
    agent.getHostnames().clear();

    await request(new URL("https://aikido.dev"));
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await request(require("url").parse("https://aikido.dev"));
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: "443" },
    ]);
    agent.getHostnames().clear();

    await request({
      origin: "https://aikido.dev",
    });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: "443" },
    ]);
    agent.getHostnames().clear();

    await t.rejects(() => request("invalid url"));
    await t.rejects(() => request({ hostname: "" }));

    await runWithContext(context, async () => {
      await request("https://google.com");

      const error0 = await t.rejects(() => request("http://localhost:9876"));
      if (error0 instanceof Error) {
        // @ts-expect-error Added in Node.js 16.9.0, but because this test is skipped in Node.js 16 because of the lack of fetch, it's fine
        t.same(error0.code, "ECONNREFUSED");
      }

      const error1 = await t.rejects(() =>
        request("http://localhost:4000/api/internal")
      );
      if (error1 instanceof Error) {
        t.same(
          error1.message,
          "Aikido firewall has blocked a server-side request forgery: undici.request(...) originating from body.image"
        );
      }
      const error2 = await t.rejects(() =>
        request(new URL("http://localhost:4000/api/internal"))
      );
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Aikido firewall has blocked a server-side request forgery: undici.request(...) originating from body.image"
        );
      }
      const error3 = await t.rejects(() =>
        request({
          protocol: "http:",
          hostname: "localhost",
          port: 4000,
          path: "/api/internal",
        })
      );
      if (error3 instanceof Error) {
        t.same(
          error3.message,
          "Aikido firewall has blocked a server-side request forgery: undici.request(...) originating from body.image"
        );
      }

      const error4 = await t.rejects(() =>
        fetch(["http://localhost:4000/api/internal"])
      );
      if (error4 instanceof Error) {
        t.same(
          error4.message,
          "Aikido firewall has blocked a server-side request forgery: undici.fetch(...) originating from body.image"
        );
      }

      const oldUrl = require("url");
      const error5 = t.throws(() =>
        request(oldUrl.parse("https://localhost:4000/api/internal"))
      );
      if (error5 instanceof Error) {
        t.same(
          error5.message,
          "Aikido firewall has blocked a server-side request forgery: undici.request(...) originating from body.image"
        );
      }
    });

    await runWithContext(
      { ...context, routeParams: { param: "http://0" } },
      async () => {
        const error = await t.rejects(() => request("http://0"));
        if (error instanceof Error) {
          t.same(
            error.message,
            "Aikido firewall has blocked a server-side request forgery: undici.request(...) originating from routeParams.param"
          );
        }
      }
    );

    await runWithContext(
      {
        ...context,
        ...{
          body: {
            image2: [
              "http://example",
              "prefix.thisdomainpointstointernalip.com",
            ],
            image: "http://thisdomainpointstointernalip.com/path",
          },
        },
      },
      async () => {
        const error = await t.rejects(() =>
          request("http://thisdomainpointstointernalip.com")
        );
        if (error instanceof Error) {
          t.same(
            error.message,
            "Aikido firewall has blocked a server-side request forgery: undici.[method](...) originating from body.image"
          );
        }

        const error2 = await t.rejects(() =>
          fetch(["http://example", "prefix.thisdomainpointstointernalip.com"])
        );
        if (error2 instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error2.cause.message,
            "Aikido firewall has blocked a server-side request forgery: undici.[method](...) originating from body.image2"
          );
        }

        // Ensure the lookup is only called once per hostname
        // Otherwise, it could be vulnerable to TOCTOU
        t.same(calls["thisdomainpointstointernalip.com"], 1);
      }
    );

    logger.clear();
    setGlobalDispatcher(new UndiciAgent({}));
    t.same(logger.getMessages(), [
      "undici.setGlobalDispatcher was called, we can't provide protection!",
    ]);
  }
);
