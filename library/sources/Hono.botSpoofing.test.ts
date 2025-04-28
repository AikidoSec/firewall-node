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
          blockedIPAddresses: [],
          blockedUserAgents: "",
          allowedIPAddresses: [],
          botSpoofingProtection: [
            {
              key: "google_test",
              uaPattern: "Googlebot|GoogleStoreBot",
              ips: ["1.2.3.4/24", "4.3.2.1"],
              hostnames: ["google.com", "googlebot.com"],
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
    allowedIPAddresses: ["5.6.7.8"],
  }),
});
agent.start([new HonoInternal(), new HTTPServer()]);
const opts = {
  skip:
    getMajorNodeVersion() < 18 ? "Hono does not support Node.js < 18" : false,
};

t.test("test bot spoofing protection", opts, async (t) => {
  const { Hono } = require("hono") as typeof import("hono");
  const { serve } =
    require("@hono/node-server") as typeof import("@hono/node-server");

  const app = new Hono();

  app.get("/", (c) => {
    return c.text("Hello, world!");
  });

  const server = serve({
    fetch: app.fetch,
    port: 8769,
  });

  {
    const response = await fetch.fetch({
      url: new URL("http://127.0.0.1:8769/"),
      headers: {
        "X-Forwarded-For": "1.1.1.1",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
    });
    t.equal(response.statusCode, 200); // Not a bot
  }
  {
    const response = await fetch.fetch({
      url: new URL("http://127.0.0.1:8769/"),
      headers: {
        "X-Forwarded-For": "1.1.1.1",
        "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
      },
    });
    t.equal(response.statusCode, 403); // IP is not a googlebot
    t.equal(response.body, "You are not allowed to access this resource.");
  }
  {
    const response = await fetch.fetch({
      url: new URL("http://127.0.0.1:8769/"),
      headers: {
        "X-Forwarded-For": "1.2.3.4",
        "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
      },
    });
    t.equal(response.statusCode, 200); // Whitelisted IP
  }
  {
    const response = await fetch.fetch({
      url: new URL("http://127.0.0.1:8769/"),
      headers: {
        "X-Forwarded-For": "4.3.2.1",
        "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
      },
    });
    t.equal(response.statusCode, 200); // Whitelisted IP
  }
  {
    const response = await fetch.fetch({
      url: new URL("http://127.0.0.1:8769/"),
      headers: {
        "X-Forwarded-For": "66.249.90.77",
        "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
      },
    });
    t.equal(response.statusCode, 200); // Real googlebot IP
  }

  server.close();
});
