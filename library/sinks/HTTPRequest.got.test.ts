import * as t from "tap";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { HTTPRequest } from "./HTTPRequest";
import { createTestAgent } from "../helpers/createTestAgent";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { isNewInstrumentationUnitTest } from "../helpers/isNewInstrumentationUnitTest";

function createContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://local.aikido.io",
    query: {},
    headers: {},
    body: {
      image: "http://localhost:4131/api/internal",
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

let server: import("http").Server;
const port = 4131;

const opts = {
  skip:
    getMajorNodeVersion() <= 21
      ? "ESM support required"
      : getMajorNodeVersion() < 25 && isNewInstrumentationUnitTest()
        ? "Because got is a ESM only package and Tapjs uses module.register, it triggers ERR_INVALID_RETURN_PROPERTY_VALUE"
        : undefined,
};

t.before(async () => {
  const { createServer } = require("http") as typeof import("http");

  server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello World\n");
  });

  server.unref();

  return new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });
});

t.test("it works", opts, async (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([new HTTPRequest()]);

  t.same(agent.getHostnames().asArray(), []);

  const gotModule = require("got");
  const got = gotModule.default;

  await runWithContext(createContext(), async () => {
    await got("https://www.aikido.dev");
  });

  t.same(agent.getHostnames().asArray(), [
    { hostname: "www.aikido.dev", port: 443, hits: 1 },
  ]);
  agent.getHostnames().clear();

  await runWithContext(createContext(), async () => {
    const error = await t.rejects(got("http://localhost:4131/api/internal"));

    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(
        error.message,
        "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
      );
    }
  });
});

t.after(async () => {
  return new Promise((resolve) => {
    server.close(resolve);
  });
});
