/* eslint-disable prefer-rest-params */
import * as dns from "node:dns";
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
  async () => {
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

    await t.rejects(() => request("invalid url"));
    await t.rejects(() => request({ hostname: "" }));

    await runWithContext(context, async () => {
      await request("https://google.com");
      const error = await t.rejects(() =>
        request("http://localhost:4000/api/internal")
      );
      if (error instanceof Error) {
        t.same(
          error.message,
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
        body: { image: "http://thisdomainpointstointernalip.com" },
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
