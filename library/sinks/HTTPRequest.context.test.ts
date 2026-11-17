import * as t from "tap";
import { Token } from "../agent/api/Token";
import { Context, getContext, runWithContext } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { HTTPRequest } from "./HTTPRequest";

const source = "http://ssrf-redirects.testssandbox.com/ssrf-test";
const destination = "http://127.0.0.1/test";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    image: source,
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it adds redirects to the context", async (t) => {
  const agent = createTestAgent({
    token: new Token("123"),
  });
  agent.start([new HTTPRequest()]);

  const http = require("http") as typeof import("http");

  await runWithContext(context, async () => {
    await new Promise<void>((resolve, reject) => {
      const request = http.request(source, (res) => {
        res.on("data", () => {});
      });

      request.on("response", () => {
        t.same(
          getContext()!.outgoingRequestRedirects!.map((r) => ({
            source: r.source.toString(),
            destination: r.destination.toString(),
          })),
          [
            {
              source: source,
              destination: destination,
            },
          ]
        );
        resolve();
      });

      request.on("error", reject);

      request.end();
    });
  });
});
