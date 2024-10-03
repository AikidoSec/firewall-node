import t from "tap";
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
    image: "http://localhost:5000/api/internal",
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const redirectTestUrl = "http://ssrf-redirects.testssandbox.com";

t.test("it works", { skip: "SSRF redirect check disabled atm" }, async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    new Token("123"),
    undefined
  );
  agent.start([new HTTPRequest()]);

  t.same(agent.getHostnames().asArray(), []);

  const needle = require("needle");

  await runWithContext(context, async () => {
    await needle("get", "https://www.aikido.dev");
  });

  t.same(agent.getHostnames().asArray(), [
    { hostname: "www.aikido.dev", port: 443 },
  ]);
  agent.getHostnames().clear();

  const error = await t.rejects(
    async () =>
      await runWithContext(context, async () => {
        await needle("get", "http://localhost:5000/api/internal");
      })
  );
  if (error instanceof Error) {
    t.same(
      error.message,
      "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
    );
  }

  await runWithContext(
    {
      ...context,
      ...{ body: { image: `${redirectTestUrl}/ssrf-test-domain` } },
    },
    async () => {
      await new Promise<void>((resolve) => {
        needle.request(
          "get",
          `${redirectTestUrl}/ssrf-test-domain`,
          {},
          {
            // eslint-disable-next-line camelcase
            follow_max: 1,
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
