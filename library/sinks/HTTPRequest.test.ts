/* eslint-disable prefer-rest-params */
import * as dns from "dns";
import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { wrap } from "../helpers/wrap";
import { HTTPRequest } from "./HTTPRequest";

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

t.test("it works", (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    new Token("123"),
    undefined
  );
  agent.start([new HTTPRequest()]);

  t.same(agent.getHostnames().asArray(), []);

  const http = require("http");
  const https = require("https");

  runWithContext(context, () => {
    const google = http.request("http://aikido.dev");
    google.end();
  });

  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 80 },
  ]);
  agent.getHostnames().clear();

  runWithContext(context, () => {
    const google = https.request("https://aikido.dev");
    google.end();
  });
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443 },
  ]);
  agent.getHostnames().clear();

  const google = https.request(new URL("https://aikido.dev"));
  google.end();
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443 },
  ]);
  agent.getHostnames().clear();

  const withoutPort = https.request({
    hostname: "aikido.dev",
    port: undefined,
  });
  t.same(withoutPort instanceof http.ClientRequest, true);
  withoutPort.end();
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443 },
  ]);
  agent.getHostnames().clear();

  const httpWithoutPort = http.request({
    hostname: "aikido.dev",
    port: undefined,
  });
  httpWithoutPort.end();
  t.same(httpWithoutPort instanceof http.ClientRequest, true);
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 80 },
  ]);
  agent.getHostnames().clear();

  const withPort = https.request({ hostname: "aikido.dev", port: 443 });
  t.same(withPort instanceof http.ClientRequest, true);
  withPort.end();
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443 },
  ]);
  agent.getHostnames().clear();

  const withStringPort = https.request({ hostname: "aikido.dev", port: "443" });
  t.same(withStringPort instanceof http.ClientRequest, true);
  withStringPort.end();
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: "443" },
  ]);
  agent.getHostnames().clear();

  t.throws(() => https.request(""));
  t.throws(() => https.request("invalid url"));
  t.same(agent.getHostnames().asArray(), []);
  agent.getHostnames().clear();

  runWithContext(
    { ...context, ...{ body: { image: "thisdomainpointstointernalip.com" } } },
    () => {
      https
        .request("https://thisdomainpointstointernalip.com")
        .on("error", (error) => {
          t.match(
            error.message,
            "Aikido firewall has blocked a server-side request forgery: https.request(...) originating from body.image"
          );

          // Ensure the lookup is only called once per hostname
          // Otherwise, it could be vulnerable to TOCTOU
          t.same(calls["thisdomainpointstointernalip.com"], 1);
        })
        .on("finish", () => {
          t.fail("should not finish");
        })
        .end();
    }
  );

  runWithContext(context, () => {
    // With lookup function specified
    const google = http.request("http://google.com", { lookup: dns.lookup });
    google.end();

    // With options object
    const google2 = http.request("http://google.com", {});
    google2.end();
  });

  runWithContext(context, () => {
    // Safe request
    const google = https.request("https://google.com");
    google.end();

    // With string URL
    const error = t.throws(() =>
      https.request("https://localhost:4000/api/internal")
    );
    if (error instanceof Error) {
      t.same(
        error.message,
        "Aikido firewall has blocked a server-side request forgery: https.request(...) originating from body.image"
      );
    }

    // With URL object
    const error2 = t.throws(() =>
      https.request(new URL("https://localhost:4000/api/internal"))
    );
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Aikido firewall has blocked a server-side request forgery: https.request(...) originating from body.image"
      );
    }

    // With object like URL
    const error3 = t.throws(() =>
      https.request({
        protocol: "https:",
        hostname: "localhost",
        port: 4000,
        path: "/api/internal",
      })
    );
    if (error3 instanceof Error) {
      t.same(
        error3.message,
        "Aikido firewall has blocked a server-side request forgery: https.request(...) originating from body.image"
      );
    }
  });

  setTimeout(() => {
    t.end();
  }, 1000);
});
