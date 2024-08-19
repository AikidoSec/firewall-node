/* eslint-disable prefer-rest-params */
import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { wrap } from "../helpers/wrap";
import { Fetch } from "./Fetch";
import * as dns from "dns";

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

const redirectTestUrl =
  "http://firewallssrfredirects-env-2.eba-7ifve22q.eu-north-1.elasticbeanstalk.com";

const redirectUrl = {
  ip: `${redirectTestUrl}/ssrf-test`,
  domain: `${redirectTestUrl}/ssrf-test-domain`,
  ipTwice: `${redirectTestUrl}/ssrf-test-twice`,
  domainTwice: `${redirectTestUrl}/ssrf-test-domain-twice`,
};

t.test(
  "it works",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    const agent = new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      undefined,
      undefined
    );
    agent.start([new Fetch()]);

    t.same(agent.getHostnames().asArray(), []);

    await fetch("http://aikido.dev");

    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 80 },
    ]);
    agent.getHostnames().clear();

    await fetch(new URL("https://aikido.dev"));

    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await t.rejects(() => fetch(""));
    await t.rejects(() => fetch("invalid url"));

    t.same(agent.getHostnames().asArray(), []);
    agent.getHostnames().clear();

    await runWithContext(context, async () => {
      // Don't await fetch to see how it handles
      // multiple requests at the same time
      // Because there's a single instance of the dispatcher
      fetch("https://google.com");

      const error0 = await t.rejects(() => fetch("http://localhost:9876"));
      if (error0 instanceof Error) {
        // @ts-expect-error Added in Node.js 16.9.0, but because this test is skipped in Node.js 16 because of the lack of fetch, it's fine
        t.same(error0.cause.code, "ECONNREFUSED");
      }

      const error = await t.rejects(() =>
        fetch("http://localhost:4000/api/internal")
      );
      if (error instanceof Error) {
        t.same(
          error.message,
          "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }

      const error2 = await t.rejects(() =>
        fetch(new URL("http://localhost:4000/api/internal"))
      );
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }
    });

    await runWithContext(
      {
        ...context,
        ...{ body: { image: "http://thisdomainpointstointernalip.com" } },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch("http://thisdomainpointstointernalip.com")
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }

        // Ensure the lookup is only called once per hostname
        // Otherwise, it could be vulnerable to TOCTOU
        t.same(calls["thisdomainpointstointernalip.com"], 1);
      }
    );

    await runWithContext(
      {
        ...context,
        // Redirects to http://127.0.0.1/test
        ...{ body: { image: redirectUrl.ip } },
      },
      async () => {
        const error = await t.rejects(() => fetch(redirectUrl.ip));
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...context,
        // Redirects to http://local.aikido.io/test
        ...{ body: { image: redirectUrl.domain } },
      },
      async () => {
        const error = await t.rejects(() => fetch(redirectUrl.domain));
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...context,
        // Redirects to /ssrf-test
        ...{ body: { image: redirectUrl.ipTwice } },
      },
      async () => {
        const error = await t.rejects(() => fetch(redirectUrl.ipTwice));
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...context,
        // Redirects to /ssrf-test-domain
        ...{ body: { image: redirectUrl.domainTwice } },
      },
      async () => {
        const error = await t.rejects(() => fetch(redirectUrl.domainTwice));
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...context,
        ...{
          body: {
            image:
              "http://ec2-13-60-120-68.eu-north-1.compute.amazonaws.com/ssrf-test-absolute-domain",
          },
        },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch(
            "http://ec2-13-60-120-68.eu-north-1.compute.amazonaws.com/ssrf-test-absolute-domain"
          )
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    // Manual redirect
    await runWithContext(
      {
        ...context,
        // Redirects to http://127.0.0.1/test
        ...{ body: { image: redirectUrl.ip } },
      },
      async () => {
        const response = await fetch(redirectUrl.ip, {
          redirect: "manual",
        });
        t.same(response.status, 302);
        const error = await t.rejects(() =>
          fetch(response.headers.get("location")!)
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    // Manual redirect
    await runWithContext(
      {
        ...context,
        // Redirects to http://local.aikido.io/test
        ...{ body: { image: redirectUrl.domain } },
      },
      async () => {
        const response = await fetch(redirectUrl.domain, {
          redirect: "manual",
        });
        t.same(response.status, 302);
        const error = await t.rejects(() =>
          fetch(response.headers.get("location")!, {
            redirect: "manual",
          })
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...context,
        ...{
          body: {
            image:
              "http://ec2-13-60-120-68.eu-north-1.compute.amazonaws.com/ssrf-test-absolute-domain",
          },
        },
      },
      async () => {
        const response = await fetch(
          "http://ec2-13-60-120-68.eu-north-1.compute.amazonaws.com/ssrf-test-absolute-domain",
          {
            redirect: "manual",
          }
        );
        t.same(response.status, 302);
        const error = await t.rejects(() =>
          fetch(response.headers.get("location")!)
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );
  }
);
