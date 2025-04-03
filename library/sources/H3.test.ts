import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { H3 } from "./H3";
import { HTTPServer } from "./HTTPServer";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import { createTestAgent } from "../helpers/createTestAgent";
import { getContext } from "../agent/Context";

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
    const {
      createApp,
      defineEventHandler,
      toNodeListener,
      createRouter,
      setResponseStatus,
      readBody,
      readFormData,
      readMultipartFormData,
      readRawBody,
      readValidatedBody,
    } = require("h3") as typeof import("h3");

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

    router.add(
      "/context2",
      defineEventHandler({
        onRequest: [],
        onBeforeResponse: [],
        handler: (event) => {
          return getContext();
        },
      })
    );

    router.post(
      "/post-json",
      defineEventHandler(async (event) => {
        const body = await readBody(event);

        return {
          context: getContext(),
          body,
        };
      })
    );

    router.post(
      "/post-form-data",
      defineEventHandler(async (event) => {
        const body = await readFormData(event);
        return {
          context: getContext(),
          body: body.getAll("arr"),
        };
      })
    );

    router.post(
      "/post-multipart-form-data",
      defineEventHandler(async (event) => {
        const body = await readMultipartFormData(event);
        return {
          context: getContext(),
          body,
        };
      })
    );

    router.post(
      "/post-raw-body",
      defineEventHandler(async (event) => {
        const body = await readRawBody(event);
        return {
          context: getContext(),
          body,
        };
      })
    );

    router.post(
      "/post-validated-body",
      defineEventHandler(async (event) => {
        const body = await readValidatedBody(event, (body) => {
          return typeof body === "object" && body !== null;
        });
        return {
          context: getContext(),
          body,
        };
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

    {
      const response = await fetch("http://localhost:4123/context2");
      const body = await response.json();
      t.match(body, {
        method: "GET",
        url: "/context2",
        headers: {
          host: "localhost:4123",
          connection: "keep-alive",
          accept: "*/*",
          "accept-language": "*",
          "sec-fetch-mode": "cors",
          "user-agent": "node",
          "accept-encoding": "gzip, deflate",
        },
        route: "/context2",
        query: {},
        source: "h3",
        routeParams: {},
        cookies: {},
      });
    }

    {
      const response = await fetch("http://localhost:4123/post-json", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ abc: "123", arr: [1, 2, 3] }),
      });

      const body = await response.json();
      t.match(body, {
        context: {
          method: "POST",
          url: "/post-json",
          headers: {
            "content-type": "application/json",
          },
          body: {
            abc: "123",
            arr: [1, 2, 3],
          },
        },
        body: {
          abc: "123",
          arr: [1, 2, 3],
        },
      });
    }

    {
      const response = await fetch("http://localhost:4123/post-form-data", {
        method: "POST",
        body: "abc=123&arr=1&arr=2&arr=3",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
      });
      const body = await response.json();
      t.match(body, {
        context: {
          method: "POST",
          url: "/post-form-data",
          body: {
            abc: "123",
            arr: ["1", "2", "3"],
          },
        },
        body: ["1", "2", "3"],
      });
    }

    server.close();
  }
);
