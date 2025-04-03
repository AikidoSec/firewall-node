import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { H3 } from "./H3";
import { HTTPServer } from "./HTTPServer";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import { createTestAgent } from "../helpers/createTestAgent";
import { getContext } from "../agent/Context";
import { setResponseStatus } from "h3";

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
    allowedIPAddresses: ["4.3.2.1", "123.1.2.0/24"],
  }),
});
agent.start([new H3(), new HTTPServer()]);

t.test(
  "it works ",
  {
    skip:
      getMajorNodeVersion() < 20 ? "h3 does not work on node < 20" : undefined,
  },
  async (t) => {
    const { createApp, defineEventHandler, toNodeListener, createRouter } =
      require("h3") as typeof import("h3");

    const { createServer } = require("http") as typeof import("http");

    const app = createApp({
      onRequest: (event) => {
        if (event.method === "OPTIONS") {
          setResponseStatus(event, 204);
        }
      },
    });

    const router = createRouter();

    router.get(
      "/context",
      defineEventHandler(() => {
        return getContext();
      })
    );

    router.get(
      "/context/:name",
      defineEventHandler((event) => {
        return getContext();
      })
    );

    app.use(router);

    const server = createServer(toNodeListener(app));
    await new Promise<void>((resolve) => {
      server.listen(4123, resolve);
    });

    {
      const response = await fetch("http://localhost:4123/context?abc=123");
      const body = await response.json();
      t.match(body, {
        method: "GET",
        url: "/context",
        headers: {
          host: "localhost:4123",
          connection: "keep-alive",
          accept: "*/*",
          "accept-language": "*",
          "sec-fetch-mode": "cors",
          "user-agent": "node",
          "accept-encoding": "gzip, deflate",
        },
        route: "/context",
        query: {
          abc: "123",
        },
        source: "h3",
        routeParams: {},
        cookies: {},
      });
      t.ok(isLocalhostIP(body.remoteAddress));
    }

    {
      const response = await fetch("http://localhost:4123/context/test", {
        headers: {
          cookie: "abc=123",
        },
      });
      const body = await response.json();
      t.match(body, {
        method: "GET",
        url: "/context/test",
        headers: {
          host: "localhost:4123",
          connection: "keep-alive",
          accept: "*/*",
        },
        route: "/context/test",
        query: {},
        source: "h3",
        routeParams: {
          name: "test",
        },
        cookies: {
          abc: "123",
        },
      });
    }

    server.close();
  }
);
