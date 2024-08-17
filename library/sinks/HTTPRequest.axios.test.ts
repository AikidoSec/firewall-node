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

t.test("it works", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    new Token("123"),
    undefined
  );
  agent.start([new HTTPRequest()]);

  t.same(agent.getHostnames().asArray(), []);

  const axios = require("axios");

  await runWithContext(context, async () => {
    await axios.request("https://www.aikido.dev");
  });

  t.same(agent.getHostnames().asArray(), [
    { hostname: "www.aikido.dev", port: 443 },
  ]);
  agent.getHostnames().clear();

  const error = await t.rejects(
    runWithContext(
      {
        ...context,
        // Redirects to http://127.0.0.1/test
        ...{ body: { image: "https://dub.sh/aikido-ssrf-test" } },
      },
      async () => {
        await axios.request("https://dub.sh/aikido-ssrf-test");
      }
    )
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      "Aikido firewall has blocked a server-side request forgery: http.request(...) originating from body.image"
    );
  }
});