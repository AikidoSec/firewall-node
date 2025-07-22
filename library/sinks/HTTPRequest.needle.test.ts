import * as t from "tap";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { HTTPRequest } from "./HTTPRequest";
import { createTestAgent } from "../helpers/createTestAgent";

function createContext(obj = {}): Context {
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

t.test("it works", async (t) => {
  const agent = createTestAgent();
  agent.start([new HTTPRequest()]);

  t.same(agent.getHostnames().asArray(), []);

  const needle = require("needle") as typeof import("needle");

  await runWithContext(createContext(), async () => {
    await needle("get", "https://app.aikido.dev");
  });

  t.same(agent.getHostnames().asArray(), [
    { hostname: "app.aikido.dev", port: 443, hits: 1 },
  ]);
  agent.getHostnames().clear();

  const error = await t.rejects(
    async () =>
      await runWithContext(createContext(), async () => {
        await needle("get", "http://localhost:5000/api/internal");
      })
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.same(
      error.message,
      "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
    );
  }
});

const redirectTestUrl = "http://ssrf-redirects.testssandbox.com";

t.test(
  "it detects SSRF attacks with redirects",
  {
    skip:
      getMajorNodeVersion() >= 19 ? "This request hangs on Node.js 19+" : false,
  },
  async (t) => {
    const agent = createTestAgent({
      token: new Token("123"),
    });
    agent.start([new HTTPRequest()]);

    const needle = require("needle") as typeof import("needle");

    await runWithContext(
      createContext({ body: { image: `${redirectTestUrl}/ssrf-test-domain` } }),
      async () => {
        await new Promise<void>((resolve) => {
          needle.request(
            "get",
            `${redirectTestUrl}/ssrf-test-domain`,
            {},
            {
              /* eslint-disable camelcase */
              follow_max: 1,
              open_timeout: 5000,
              response_timeout: 5000,
              read_timeout: 5000,
              /* eslint-enable camelcase */
            },
            (error, response) => {
              t.ok(error instanceof Error);
              t.match(
                error?.message,
                /Zen has blocked a server-side request forgery/
              );
              resolve();
            }
          );
        });
      }
    );
  }
);
