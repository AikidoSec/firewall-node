import { type IncomingMessage } from "http";
import * as t from "tap";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { HTTPRequest } from "./HTTPRequest";
import { createTestAgent } from "../helpers/createTestAgent";

function createContext(obj: Partial<Context> = {}): Context {
  return {
    ...{
      remoteAddress: "::1",
      method: "POST",
      url: "http://localhost:4000",
      query: {},
      headers: {},
      body: {
        image: "http://localhost:5000/api/internal",
      },
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/posts/:id",
    },
    ...obj,
  };
}

const redirectTestUrl = "http://ssrf-redirects.testssandbox.com";
const redirectTestUrl2 =
  "http://firewallssrfredirects-env-2.eba-7ifve22q.eu-north-1.elasticbeanstalk.com";

const redirectUrl = {
  ip: `${redirectTestUrl}/ssrf-test`, // Redirects to http://127.0.0.1/test
  domain: `${redirectTestUrl}/ssrf-test-domain`, // Redirects to http://local.aikido.io/test
  ipTwice: `${redirectTestUrl}/ssrf-test-twice`, // Redirects to /ssrf-test
  domainTwice: `${redirectTestUrl}/ssrf-test-domain-twice`, // Redirects to /ssrf-test-domain
};

function consumeBody(res: IncomingMessage) {
  // We need to consume the body
  // From Node.19+ this would otherwise hang the test
  res.on("readable", () => {
    while (res.read() !== null) {}
  });
}

t.test("it works", (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([new HTTPRequest()]);

  const http = require("http") as typeof import("http");

  runWithContext(
    createContext({
      body: { image: redirectUrl.ip },
    }),
    () => {
      const response1 = http.request(redirectUrl.ip, (res) => {
        t.same(res.statusCode, 302);
        t.same(res.headers.location, "http://127.0.0.1/test");

        consumeBody(res);

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
    createContext({
      body: { test: redirectUrl.domain },
    }),
    () => {
      const response1 = http.request(redirectUrl.domain, (res) => {
        t.same(res.statusCode, 302);
        t.same(res.headers.location, "http://local.aikido.io/test");
        consumeBody(res);

        http.request("http://local.aikido.io/test").on("error", (e) => {
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
    createContext({
      body: { image: redirectUrl.ipTwice },
    }),
    () => {
      const response1 = http.request(redirectUrl.ipTwice, (res) => {
        t.same(res.statusCode, 302);
        t.same(res.headers.location, "/ssrf-test");

        consumeBody(res);

        const response2 = http.request(redirectUrl.ip, (res) => {
          consumeBody(res);

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
    createContext({
      body: { image: redirectUrl.domainTwice },
    }),
    () => {
      const response1 = http.request(redirectUrl.domainTwice, (res) => {
        t.same(res.statusCode, 302);
        t.same(res.headers.location, "/ssrf-test-domain");

        consumeBody(res);

        const response2 = http.request(redirectUrl.domain, (res) => {
          consumeBody(res);

          http.request("http://local.aikido.io/test").on("error", (e) => {
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
    createContext({
      body: {
        image: `${redirectTestUrl2}/ssrf-test-absolute-domain`,
      },
    }),
    () => {
      const response1 = http.request(
        `${redirectTestUrl2}/ssrf-test-absolute-domain`
      );
      response1.on("response", (res) => {
        t.same(res.statusCode, 302);
        t.same(res.headers.location, `${redirectTestUrl2}/ssrf-test-domain`);

        consumeBody(res);

        const response2 = http.request(`${redirectTestUrl2}/ssrf-test-domain`);
        response2.prependOnceListener("response", (res) => {
          consumeBody(res);

          http
            .request("http://local.aikido.io/test")
            .on("error", (e) => {
              t.same(
                e.message,
                "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
              );
            })
            .end();
        });
        response2.end();
      });
      response1.end();
    }
  );

  setTimeout(() => {
    t.end();
  }, 3000);
});
