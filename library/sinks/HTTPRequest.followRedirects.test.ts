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

t.test("it works", (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    new Token("123"),
    undefined
  );
  agent.start([new HTTPRequest()]);

  const { https } = require("follow-redirects");

  runWithContext(
    {
      ...context,
      // Redirects to http://127.0.0.1/test
      ...{ body: { image: "https://dub.sh/aikido-ssrf-test" } },
    },
    () => {
      const response = https.request(
        "https://dub.sh/aikido-ssrf-test",
        (res) => {
          t.fail("should not respond");
        }
      );
      response.on("error", (e) => {
        t.ok(e instanceof Error);
        t.same(
          e.message,
          "Redirected request failed: Aikido firewall has blocked a server-side request forgery: http.request(...) originating from body.image"
        );
      });
      response.end();
    }
  );

  runWithContext(
    {
      ...context,
      // Redirects to http://local.aikido.io/test
      ...{ body: { image: "https://dub.sh/aikido-ssrf-test-domain" } },
    },
    () => {
      const response = https.request(
        "https://dub.sh/aikido-ssrf-test-domain",
        (res) => {
          t.fail("should not respond");
        }
      );
      response.on("error", (e) => {
        t.ok(e instanceof Error);
        t.same(
          e.message,
          "Aikido firewall has blocked a server-side request forgery: http.request(...) originating from body.image"
        );
      });
      response.end();
    }
  );

  setTimeout(() => {
    t.end();
  }, 3000);
});
