import { Agent } from "http";
import * as t from "tap";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { HTTPRequest } from "./HTTPRequest";
import { createTestAgent } from "../helpers/createTestAgent";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";

const context: Context = {
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
};

t.test("it works", async (t) => {
  const agent = createTestAgent();
  agent.start([new HTTPRequest()]);

  t.same(agent.getHostnames().asArray(), []);

  let needle = require("needle") as typeof import("needle");
  if (isEsmUnitTest()) {
    // @ts-expect-error in ESM the default export is the needle function
    needle = needle.default;
  }

  await runWithContext(context, async () => {
    await needle("get", "https://app.aikido.dev");
  });

  t.same(agent.getHostnames().asArray(), [
    { hostname: "app.aikido.dev", port: 443, hits: 1 },
  ]);
  agent.getHostnames().clear();

  const error = await t.rejects(
    async () =>
      await runWithContext(context, async () => {
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

t.test("it detects SSRF attacks with redirects", async (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([new HTTPRequest()]);

  let needle = require("needle") as typeof import("needle");
  if (isEsmUnitTest()) {
    // @ts-expect-error in ESM the default export is the needle function
    needle = needle.default;
  }

  await runWithContext(
    {
      ...context,
      body: { image: `${redirectTestUrl}/ssrf-test-domain` },
    },
    async () => {
      await new Promise<void>((resolve) => {
        needle.request(
          "get",
          `${redirectTestUrl}/ssrf-test-domain`,
          {},
          {
            follow_max: 1,
            // Needle doesn't consume the body of the redirect response
            // The default agent of Node.js 19+ keeps the connection alive, which makes the request hang
            agent: new Agent({ keepAlive: false }),
            open_timeout: 5000,
            response_timeout: 5000,
            read_timeout: 5000,
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
});
