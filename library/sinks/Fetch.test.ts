/* eslint-disable prefer-rest-params */
import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { addHook, removeHook } from "../agent/hooks";
import { wrap } from "../helpers/wrap";
import { Fetch } from "./Fetch";
import * as dns from "dns";
import { createTestAgent } from "../helpers/createTestAgent";

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
    url: "http://local.aikido.io:4000",
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
}

const redirectTestUrl = "http://ssrf-redirects.testssandbox.com";
const redirecTestUrl2 =
  "http://firewallssrfredirects-env-2.eba-7ifve22q.eu-north-1.elasticbeanstalk.com";
const redirectTestUrl3 = "https://ssrf-rédirects.testssandbox.com";

const redirectUrl = {
  ip: `${redirectTestUrl}/ssrf-test`, // Redirects to http://127.0.0.1/test
  domain: `${redirectTestUrl}/ssrf-test-domain`, // Redirects to http://local.aikido.io/test
  ipTwice: `${redirectTestUrl}/ssrf-test-twice`, // Redirects to /ssrf-test
  domainTwice: `${redirectTestUrl}/ssrf-test-domain-twice`, // Redirects to /ssrf-test-domain
  ipv6: `${redirectTestUrl}/ssrf-test-ipv6`, // Redirects to http://[::1]/test
  ipv6Twice: `${redirectTestUrl}/ssrf-test-ipv6-twice`, // Redirects to /ssrf-test-ipv6
};

t.test(
  "it works",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    const api = new ReportingAPIForTesting();
    const agent = createTestAgent({
      token: new Token("123"),
      api,
    });

    agent.start([new Fetch()]);

    t.same(agent.getHostnames().asArray(), []);

    const hookArgs: unknown[] = [];
    const hook = (args: unknown) => {
      hookArgs.push(args);
    };
    addHook("beforeOutboundRequest", hook);
    await fetch("http://app.aikido.dev");
    t.same(agent.getHostnames().asArray(), [
      { hostname: "app.aikido.dev", port: 80, hits: 1 },
    ]);
    agent.getHostnames().clear();
    t.same(hookArgs, [
      {
        url: new URL("http://app.aikido.dev"),
        method: "GET",
        port: 80,
      },
    ]);
    removeHook("beforeOutboundRequest", hook);

    await fetch(new URL("https://app.aikido.dev"));

    t.same(agent.getHostnames().asArray(), [
      { hostname: "app.aikido.dev", port: 443, hits: 1 },
    ]);
    agent.getHostnames().clear();

    await t.rejects(() => fetch(""));
    await t.rejects(() => fetch("invalid url"));

    t.same(agent.getHostnames().asArray(), []);
    agent.getHostnames().clear();

    await fetch(new Request("https://app.aikido.dev"));

    t.same(agent.getHostnames().asArray(), [
      { hostname: "app.aikido.dev", port: 443, hits: 1 },
    ]);

    agent.getHostnames().clear();

    await runWithContext(createContext(), async () => {
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
          // @ts-expect-error Type is not defined
          error.cause.message,
          "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }

      const events = api
        .getEvents()
        .filter((e) => e.type === "detected_attack");
      t.same(events.length, 1);
      t.same(events[0].attack.metadata, {
        hostname: "localhost",
        port: "4000",
        privateIP: "::1",
      });

      const error2 = await t.rejects(() =>
        fetch(new URL("http://localhost:4000/api/internal"))
      );
      if (error2 instanceof Error) {
        t.same(
          // @ts-expect-error Type is not defined
          error2.cause.message,
          "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }

      const error3 = await t.rejects(() =>
        // @ts-expect-error Test
        fetch(["http://localhost:4000/api/internal"])
      );
      if (error3 instanceof Error) {
        t.same(
          // @ts-expect-error Type is not defined
          error3.cause.message,
          "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }

      const error4 = await t.rejects(() =>
        fetch(new Request("http://localhost:4000/api/internal"))
      );
      if (error4 instanceof Error) {
        t.same(
          // @ts-expect-error Type is not defined
          error4.cause.message,
          "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }
    });

    await runWithContext(
      {
        ...createContext(),
        body: {
          image2: ["http://example", "prefix.thisdomainpointstointernalip.com"],
          image: "http://thisdomainpointstointernalip.com/path",
        },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch("http://thisdomainpointstointernalip.com")
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }

        const error2 = await t.rejects(() =>
          // @ts-expect-error Test
          fetch(["http://example", "prefix.thisdomainpointstointernalip.com"])
        );
        if (error2 instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error2.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image2"
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
        body: { image: redirectUrl.ip },
      },
      async () => {
        const error = await t.rejects(() => fetch(redirectUrl.ip));
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: { image: `${redirectTestUrl3}/ssrf-test` },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch(`${redirectTestUrl3}/ssrf-test`)
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: { image: redirectUrl.domain },
      },
      async () => {
        const error = await t.rejects(() => fetch(redirectUrl.domain));
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: { image: `${redirectTestUrl3}/ssrf-test-domain` },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch(`${redirectTestUrl3}/ssrf-test-domain`)
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: { image: redirectUrl.ipTwice },
      },
      async () => {
        const error = await t.rejects(() => fetch(redirectUrl.ipTwice));
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: { image: `${redirectTestUrl3}/ssrf-test-twice` },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch(`${redirectTestUrl3}/ssrf-test-twice`)
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: { image: redirectUrl.domainTwice },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch(new Request(redirectUrl.domainTwice))
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: { image: `${redirectTestUrl3}/ssrf-test-domain-twice` },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch(`${redirectTestUrl3}/ssrf-test-domain-twice`)
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: { image: redirectUrl.ipv6 },
      },
      async () => {
        const error = await t.rejects(() => fetch(redirectUrl.ipv6));
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: { image: redirectUrl.ipv6Twice },
      },
      async () => {
        const error = await t.rejects(() => fetch(redirectUrl.ipv6Twice));
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: {
          image: `${redirecTestUrl2}/ssrf-test-absolute-domain`,
        },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch(`${redirecTestUrl2}/ssrf-test-absolute-domain`)
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),
        body: {
          image: `${redirectTestUrl3}/ssrf-test-absolute-domain`,
        },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch(`${redirectTestUrl3}/ssrf-test-absolute-domain`)
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    // Manual redirect
    await runWithContext(
      {
        ...createContext(),
        body: { image: redirectUrl.ip },
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
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    // Manual redirect
    await runWithContext(
      {
        ...createContext(),
        body: { image: redirectUrl.domain },
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
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );

    await runWithContext(
      {
        ...createContext(),

        body: {
          image: `${redirecTestUrl2}/ssrf-test-absolute-domain`,
        },
      },
      async () => {
        const response = await fetch(
          `${redirecTestUrl2}/ssrf-test-absolute-domain`,
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
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
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
          fetch("http://my-service-hostname")
        );
        if (error instanceof Error) {
          // @ts-expect-error Type is not defined
          t.same(error.cause.code, "ECONNREFUSED");
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
        const error = await t.rejects(() =>
          fetch("http://metadata/computeMetadata/v1/instance/")
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Zen has blocked a server-side request forgery: fetch(...) originating from body.metadataHost"
          );
        } else {
          t.fail("Expected an error to be thrown");
        }
      }
    );
  }
);
