/* eslint-disable prefer-rest-params */
import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { wrap } from "../helpers/wrap";
import { Hono as HonoInternal } from "./Hono";
import { HTTPServer } from "./HTTPServer";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createTestAgent } from "../helpers/createTestAgent";
import * as fetch from "../helpers/fetch";

wrap(fetch, "fetch", function mock(original) {
  return async function mock(this: typeof fetch) {
    if (
      arguments.length > 0 &&
      arguments[0] &&
      arguments[0].url.toString().includes("firewall")
    ) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          blockedIPAddresses: [
            {
              source: "geoip",
              description: "geo restrictions",
              ips: ["1.3.2.0/24", "fe80::1234:5678:abcd:ef12/64"],
            },
          ],
          blockedUserAgents: "hacker|attacker",
          allowedIPAddresses: [
            {
              source: "geoip",
              description: "geo restrictions",
              ips: ["4.3.2.1"],
            },
          ],
        }),
      };
    }

    return await original.apply(this, arguments);
  };
});

const agent = createTestAgent({
  token: new Token("123"),
  api: new ReportingAPIForTesting({
    success: true,
    endpoints: [
      {
        method: "GET",
        route: "/rate-limited",
        forceProtectionOff: false,
        rateLimiting: {
          windowSizeInMS: 2000,
          maxRequests: 2,
          enabled: true,
        },
      },
    ],
    blockedUserIds: ["567"],
    configUpdatedAt: 0,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    allowedIPAddresses: ["4.3.2.1"],
  }),
});
agent.start([new HonoInternal(), new HTTPServer()]);
const opts = {
  skip:
    getMajorNodeVersion() < 18 ? "Hono does not support Node.js < 18" : false,
};

t.test("test access only allowed for some IP addresses", opts, async (t) => {
  const { Hono } = require("hono") as typeof import("hono");
  const { serve } =
    require("@hono/node-server") as typeof import("@hono/node-server");

  const app = new Hono();

  app.get("/", (c) => {
    return c.text("Hello, world!");
  });

  const server = serve({
    fetch: app.fetch,
    port: 8768,
  });

  const response = await fetch.fetch({
    url: new URL("http://127.0.0.1:8768/"),
    headers: {
      "X-Forwarded-For": "1.3.2.4",
    },
  });
  t.equal(response.statusCode, 403);
  t.equal(
    response.body,
    "Your IP address is not allowed to access this resource. (Your IP: 1.3.2.4)"
  );

  const response2 = await fetch.fetch({
    url: new URL("http://127.0.0.1:8768/"),
    headers: {
      "X-Forwarded-For": "4.3.2.1",
    },
  });
  t.equal(response2.statusCode, 200);

  // Always allow localhost
  const response3 = await fetch.fetch({
    url: new URL("http://127.0.0.1:8768/"),
    headers: {
      "X-Forwarded-For": "127.0.0.1",
    },
  });
  t.equal(response3.statusCode, 200);

  // Allow private IP ranges
  const response4 = await fetch.fetch({
    url: new URL("http://127.0.0.1:8768/"),
    headers: {
      "X-Forwarded-For": "10.0.2.4",
    },
  });
  t.equal(response4.statusCode, 200);

  server.close();
});
