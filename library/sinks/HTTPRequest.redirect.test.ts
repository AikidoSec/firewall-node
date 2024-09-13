/* eslint-disable prefer-rest-params */
import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { HTTPRequest } from "./HTTPRequest";

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

const redirectTestUrl =
  "http://firewallssrfredirects-env-2.eba-7ifve22q.eu-north-1.elasticbeanstalk.com";

const redirectUrl = {
  ip: `${redirectTestUrl}/ssrf-test`, // Redirects to http://127.0.0.1/test
  domain: `${redirectTestUrl}/ssrf-test-domain`, // Redirects to http://local.aikido.io/test
  ipTwice: `${redirectTestUrl}/ssrf-test-twice`, // Redirects to /ssrf-test
  domainTwice: `${redirectTestUrl}/ssrf-test-domain-twice`, // Redirects to /ssrf-test-domain
};

t.test("it works", { skip: "SSRF redirect check disabled atm" }, (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    new Token("123"),
    undefined
  );
  agent.start([new HTTPRequest()]);

  const http = require("http");

  runWithContext(
    {
      ...context,
      ...{ body: { image: redirectUrl.ip } },
    },
    () => {
      const response1 = http.request(redirectUrl.ip, (res) => {
        t.same(res.statusCode, 302);
        t.same(res.headers.location, "http://127.0.0.1/test");
        const error = t.throws(() => http.request("http://127.0.0.1/test"));
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
          );
        }
      });
      response1.end();
    }
  );

  runWithContext(
    {
      ...context,
      ...{ body: { test: redirectUrl.domain } },
    },
    () => {
      const response1 = http.request(redirectUrl.domain, (res) => {
        t.same(res.statusCode, 302);
        t.same(res.headers.location, "http://local.aikido.io/test");
        http.request("http://local.aikido.io/test").on("error", (e) => {
          t.ok(e instanceof Error);
          t.same(
            e.message,
            "Zen has blocked a server-side request forgery: http.request(...) originating from body.test"
          );
        });
      });
      response1.end();
    }
  );

  runWithContext(
    {
      ...context,
      ...{ body: { image: redirectUrl.ipTwice } },
    },
    () => {
      const response1 = http.request(redirectUrl.ipTwice, (res) => {
        t.same(res.statusCode, 302);
        t.same(res.headers.location, "/ssrf-test");
        const response2 = http.request(redirectUrl.ip, (res) => {
          const error = t.throws(() => http.request("http://127.0.0.1/test"));
          t.ok(error instanceof Error);
          if (error instanceof Error) {
            t.same(
              error.message,
              "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
            );
          }
        });
        response2.end();
      });
      response1.end();
    }
  );

  runWithContext(
    {
      ...context,
      ...{ body: { image: redirectUrl.domainTwice } },
    },
    () => {
      const response1 = http.request(redirectUrl.domainTwice, (res) => {
        t.same(res.statusCode, 302);
        t.same(res.headers.location, "/ssrf-test-domain");
        const response2 = http.request(redirectUrl.domain, (res) => {
          http.request("http://local.aikido.io/test").on("error", (e) => {
            t.ok(e instanceof Error);
            t.same(
              e.message,
              "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
            );
          });
        });
        response2.end();
      });
      response1.end();
    }
  );

  runWithContext(
    {
      ...context,
      ...{
        body: {
          image:
            "http://ec2-13-60-120-68.eu-north-1.compute.amazonaws.com/ssrf-test-absolute-domain",
        },
      },
    },
    () => {
      const response1 = http.request(
        "http://ec2-13-60-120-68.eu-north-1.compute.amazonaws.com/ssrf-test-absolute-domain",
        (res) => {
          t.same(res.statusCode, 302);
          t.same(res.headers.location, redirectUrl.domain);
          const response2 = http.request(redirectUrl.domain, (res) => {
            http.request("http://local.aikido.io/test").on("error", (e) => {
              t.ok(e instanceof Error);
              t.same(
                e.message,
                "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
              );
            });
          });
          response2.end();
        }
      );
      response1.end();
    }
  );

  setTimeout(() => {
    t.end();
  }, 3000);
});
