import * as t from "tap";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { HTTPRequest } from "./HTTPRequest";
import { createTestAgent } from "../helpers/createTestAgent";

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

const redirectTestUrl = "http://ssrf-redirects.testssandbox.com";

t.test("it works", { skip: "SSRF redirect check disabled atm" }, async (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });

  agent.start([new HTTPRequest()]);

  t.same(agent.getHostnames().asArray(), []);

  const axios = require("axios");

  await runWithContext(context, async () => {
    await axios.request("https://www.aikido.dev");
  });

  t.same(agent.getHostnames().asArray(), [
    { hostname: "www.aikido.dev", port: 443, hits: 1 },
  ]);
  agent.getHostnames().clear();

  const error = await t.rejects(
    runWithContext(
      {
        ...context,
        // Redirects to http://127.0.0.1/test
        body: { image: `${redirectTestUrl}/ssrf-test` },
      },
      async () => {
        await axios.request(`${redirectTestUrl}/ssrf-test`);
      }
    )
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
    );
  }

  const error2 = await t.rejects(
    runWithContext(
      {
        ...context,
        // Redirects to http://[::1]/test
        body: { image: `${redirectTestUrl}/ssrf-test-ipv6` },
      },
      async () => {
        await axios.request(`${redirectTestUrl}/ssrf-test-ipv6`);
      }
    )
  );

  t.ok(error2 instanceof Error);
  if (error2 instanceof Error) {
    t.match(
      error2.message,
      "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
    );
  }
});
