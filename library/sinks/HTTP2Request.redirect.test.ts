/* eslint-disable prefer-rest-params */
import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { HTTP2Request } from "./HTTP2Request";
import { http2Request } from "../helpers/http2Request";

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

const redirectTestUrl = "https://ssrf-redirects.testssandbox.com";

const redirectUrl = {
  ip: `${redirectTestUrl}/ssrf-test`, // Redirects to http://127.0.0.1/test
  domain: `${redirectTestUrl}/ssrf-test-domain`, // Redirects to http://local.aikido.io/test
  ipTwice: `${redirectTestUrl}/ssrf-test-twice`, // Redirects to /ssrf-test
  domainTwice: `${redirectTestUrl}/ssrf-test-domain-twice`, // Redirects to /ssrf-test-domain
};

t.test("it works", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    new Token("123"),
    undefined
  );
  agent.start([new HTTP2Request()]);

  await runWithContext(
    {
      ...context,
      ...{ body: { image: redirectUrl.ip } },
    },
    async () => {
      const { headers } = await http2Request(redirectUrl.ip, "GET", {});
      t.same(headers[":status"], 302);
      t.same(headers.location, "http://127.0.0.1/test");

      try {
        const { headers } = await http2Request(
          "http://127.0.0.1/test",
          "GET",
          {}
        );
        t.fail();
      } catch (error) {
        t.match(
          error.message,
          /Aikido firewall has blocked a server-side request forgery: http2.request.* originating from body.image/
        );
      }
    }
  );

  await runWithContext(
    {
      ...context,
      ...{ body: { image: redirectUrl.ip } },
    },
    async () => {
      const { headers } = await http2Request(redirectUrl.domain, "GET", {});
      t.same(headers[":status"], 302);
      t.same(headers.location, "http://local.aikido.io/test");

      try {
        const { headers } = await http2Request(
          "http://local.aikido.io/test",
          "GET",
          {}
        );
        t.fail();
      } catch (error) {
        t.match(
          error.message,
          /Aikido firewall has blocked a server-side request forgery: http2.request.* originating from body.image/
        );
      }
    }
  );
});
