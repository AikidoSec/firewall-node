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

    if (
      hostname === "thisdomainpointstointernalip.com" ||
      hostname === "thisdomainpointstointernalip2.com"
    ) {
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

  const http = require("http") as typeof import("http");
  const https = require("https") as typeof import("https");

  runWithContext(context, () => {
    const aikido = http.request("http://aikido.dev");
    aikido.end();
  });

  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 80 },
  ]);
  agent.getHostnames().clear();

  runWithContext(context, () => {
    const aikido = https.request("https://aikido.dev");
    aikido.end();
  });
  t.same(agent.getHostnames().asArray(), [
    { hostname: "aikido.dev", port: 443 },
  ]);
  agent.getHostnames().clear();

  const aikido = https.request(new URL("https://aikido.dev"));
  aikido.end();
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
            "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
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

  runWithContext(
    { ...context, ...{ body: { image: "thisdomainpointstointernalip2.com" } } },
    () => {
      https
        .request("https://thisdomainpointstointernalip2.com", (res) => {
          t.fail("should not respond");
        })
        .on("error", (error) => {
          t.match(
            error.message,
            "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
          );
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
    const google2 = http.get("http://google.com", {});
    google2.end();
  });

  runWithContext(context, () => {
    // Safe request
    const google = https.request("https://www.google.com");
    google.end();

    // With string URL
    const error = t.throws(() =>
      https.request("https://localhost:4000/api/internal")
    );
    if (error instanceof Error) {
      t.same(
        error.message,
        "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
      );
    }

    // With URL object
    const error2 = t.throws(() =>
      https.request(new URL("https://localhost:4000/api/internal"))
    );
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
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
        "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
      );
    }

    // Using .get
    const error4 = t.throws(() =>
      https.get("https://localhost:4000/api/internal")
    );
    if (error4 instanceof Error) {
      t.same(
        error4.message,
        "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
      );
    }

    // ECONNREFUSED means that the request is not blocked
    http
      .request("http://localhost:9876")
      .on("error", (e: NodeJS.ErrnoException) => {
        t.same(e.code, "ECONNREFUSED");
      });

    https
      .request("https://localhost:9876")
      .on("error", (e: NodeJS.ErrnoException) => {
        t.same(e.code, "ECONNREFUSED");
      });

    https
      .request("https://localhost/api/internal", { port: 9876 })
      .on("error", (e: NodeJS.ErrnoException) => {
        t.same(e.code, "ECONNREFUSED");
      });

    https
      .request("https://localhost/api/internal", { defaultPort: 9876 })
      .on("error", (e: NodeJS.ErrnoException) => {
        t.same(e.code, "ECONNREFUSED");
      });

    // With options object at index 1
    const error5 = t.throws(() =>
      https.request("", {
        protocol: "https:",
        hostname: "localhost",
        port: 4000,
        path: "/api/internal",
      })
    );
    if (error5 instanceof Error) {
      t.same(
        error5.message,
        "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
      );
    }

    const oldUrl = require("url");
    const error6 = t.throws(() =>
      https.request(oldUrl.parse("https://localhost:4000/api/internal"))
    );
    if (error6 instanceof Error) {
      t.same(
        error6.message,
        "Zen has blocked a server-side request forgery: https.request(...) originating from body.image"
      );
    }
  });

  setTimeout(() => {
    t.end();
  }, 3000);
});
