import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { H3 } from "./H3";
import { HTTPServer } from "./HTTPServer";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import { createTestAgent } from "../helpers/createTestAgent";
import { getContext, runWithContext } from "../agent/Context";
import type { IncomingMessage, ServerResponse } from "http";
import { addH3Middleware } from "../middleware/h3";
import { setUser } from "../agent/context/user";
import { wrapReadBody } from "./h3/wrapReadBody";
import { getOriginal, isWrapped } from "../helpers/wrap";

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
    excludedUserIdsFromRateLimiting: [],
  }),
});
agent.start([new H3(), new HTTPServer()]);

const skip =
  getMajorNodeVersion() < 20 ? "h3 does not work on node < 20" : undefined;

t.test(
  "setH3Exports falls back to undefined if one var is not a function",
  (t) => {
    const h3Instance = new H3();

    (h3Instance as any).setH3Exports({
      getHeaders: () => {},
      getRequestURL: () => {},
      getQuery: () => {},
      parseCookies: () => {},
    });
    t.same(typeof (h3Instance as any).h3Exports, "object");

    (h3Instance as any).setH3Exports({
      getHeaders: () => {},
      getRequestURL: "not-a-function",
      getQuery: () => {},
      parseCookies: () => {},
    });
    t.equal((h3Instance as any).h3Exports, undefined);

    t.end();
  }
);

t.test(
  "multipart files with empty or missing filenames are ignored",
  async (t) => {
    const body = [
      { name: "text", data: Buffer.from("Hello world") },
      { name: "file", filename: "", data: Buffer.from("file content") },
      ...[
        "application/octet-stream",
        "Application/Octet-Stream; charset=utf-8",
      ].map((type) => ({
        name: "binary",
        type,
        data: Buffer.from("binary content"),
      })),
    ];

    await runWithContext(
      {
        url: undefined,
        method: "POST",
        query: {},
        headers: {},
        routeParams: {},
        remoteAddress: undefined,
        body: undefined,
        cookies: {},
        source: "h3",
        route: undefined,
      },
      async () => {
        t.equal(await wrapReadBody([], body), body);
        t.same(getContext()?.body, { text: "Hello world" });
      }
    );
  }
);

t.test(
  "it works ",
  {
    skip,
  },
  async (t) => {
    const {
      createApp,
      defineEventHandler,
      toNodeListener,
      createRouter,
      readBody,
      readFormData,
      readMultipartFormData,
      readRawBody,
      readValidatedBody,
      fromNodeMiddleware,
      fromWebHandler,
      eventHandler,
    } = require("h3") as typeof import("h3");

    const { createServer } = require("http") as typeof import("http");

    const app = createApp();

    const router = createRouter();

    app.use(
      defineEventHandler((event) => {
        if (event.path === "/block-user") {
          setUser({
            id: "567",
          });
        }
      })
    );

    addH3Middleware(app);

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
      eventHandler(async (event) => {
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
      "/post-raw-body-buffer",
      defineEventHandler(async (event) => {
        const body = await readRawBody(event, false);
        return {
          context: getContext(),
          body,
        };
      })
    );

    router.get(
      "/context-event-handler/:id",
      eventHandler(() => {
        return getContext();
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

    router.get(
      "/from-node-middleware",
      fromNodeMiddleware((req: IncomingMessage, res: ServerResponse) => {
        res.end(JSON.stringify(getContext()));
      })
    );

    router.get(
      "/from-web-handler",
      fromWebHandler(async (request: Request) => {
        return new Response(JSON.stringify(getContext()));
      })
    );

    app.use(
      "/middleware-2",
      defineEventHandler({
        onRequest: (event) => {
          t.same(getContext()?.source, "h3");
        },
        onBeforeResponse: (event) => {
          t.same(getContext()?.source, "h3");
        },
        handler: (event) => {
          return getContext();
        },
      })
    );

    app.use(
      "/middleware-3",
      defineEventHandler({
        onRequest: [
          async (event) => {
            const body = await readBody(event);
            t.same(getContext()?.source, "h3");
          },
          (event) => {
            t.same(getContext()?.source, "h3");
          },
        ],
        onBeforeResponse: [
          (event) => {
            t.same(getContext()?.source, "h3");
          },
        ],
        handler: (event) => {
          return getContext();
        },
      })
    );

    router.get(
      "/rate-limited",
      defineEventHandler(() => {
        return "Hello world";
      })
    );

    router.get(
      "/block-user",
      defineEventHandler(() => {
        return "Hello world";
      })
    );

    router.get(
      "/error",
      defineEventHandler(() => {
        throw new Error("Test error");
      })
    );

    app.use(router);

    const server = createServer(toNodeListener(app));
    await new Promise<void>((resolve) => {
      server.listen(4125, resolve);
    });

    let onErrorContext: ReturnType<typeof getContext> = undefined;

    const app2 = createApp({
      onRequest: (event) => {
        t.same(getContext()?.source, "h3");
      },
      onAfterResponse: (event, response) => {
        t.same(getContext()?.source, "h3");
      },
      onBeforeResponse: (event, response) => {
        t.same(getContext()?.source, "h3");
      },
      onError: (event, error) => {
        onErrorContext = getContext();
      },
    });

    app2.use(router);

    const server2 = createServer(toNodeListener(app2));
    await new Promise<void>((resolve) => {
      server2.listen(4126, resolve);
    });

    {
      const response = await fetch("http://localhost:4125/context?abc=123");
      const body = await response.json();
      t.match(
        body,
        {
          method: "GET",
          headers: {
            host: "localhost:4125",
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
        },
        "Context contains expected properties"
      );
      t.ok(isLocalhostIP(body.remoteAddress));
    }

    {
      const response = await fetch("http://localhost:4125/context/test", {
        headers: {
          cookie: "abc=123",
        },
      });
      const body = await response.json();
      t.match(body, {
        method: "GET",
        headers: {
          host: "localhost:4125",
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
      const response = await fetch("http://localhost:4125/context2");
      const body = await response.json();
      t.match(body, {
        method: "GET",
        headers: {
          host: "localhost:4125",
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
      const response = await fetch("http://localhost:4125/post-json", {
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
          route: "/post-json",
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
      const response = await fetch("http://localhost:4125/post-form-data", {
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
          route: "/post-form-data",
          body: {
            abc: "123",
            arr: ["1", "2", "3"],
          },
        },
        body: ["1", "2", "3"],
      });
    }

    {
      const formData = new FormData();
      formData.append("abc", "123");
      formData.append("arr", "1");
      formData.append("arr", "2");
      formData.append("arr", "3");
      formData.append(
        "file",
        new Blob(["a; ls"], { type: "text/plain" }),
        "file.txt"
      );
      const response = await fetch(
        "http://localhost:4125/post-multipart-form-data",
        {
          method: "POST",
          body: formData,
          headers: {},
        }
      );
      const body = await response.json();
      t.match(body, {
        context: {
          method: "POST",
          route: "/post-multipart-form-data",
          body: {
            abc: "123",
            arr: ["1", "2", "3"],
          },
        },
        body: [
          {
            name: "abc",
            data: {
              type: "Buffer",
            },
          },
          {
            name: "arr",
            data: {
              type: "Buffer",
            },
          },
        ],
      });
      t.same(body.context.body, { abc: "123", arr: ["1", "2", "3"] });
      t.match(body.body[4], {
        name: "file",
        filename: "file.txt",
        data: Buffer.from("a; ls").toJSON(),
      });
    }

    {
      const response = await fetch("http://localhost:4125/post-raw-body", {
        method: "POST",
        body: "Hello world",
        headers: {
          "content-type": "text/plain",
        },
      });
      const body = await response.json();
      t.match(body, {
        context: {
          method: "POST",
          route: "/post-raw-body",
          headers: {
            "content-type": "text/plain",
          },
          body: "Hello world",
        },
        body: "Hello world",
      });
    }

    {
      const response = await fetch(
        "http://localhost:4125/post-raw-body-buffer",
        {
          method: "POST",
          body: "Hello world",
          headers: {
            "content-type": "text/plain",
          },
        }
      );
      const body = await response.json();
      const expectedBody = Buffer.from("Hello world").toJSON();
      t.same(body.context.body, expectedBody);
      t.same(body.body, expectedBody);
    }

    {
      const response = await fetch(
        "http://localhost:4125/context-event-handler/42"
      );
      const body = await response.json();
      t.match(body, { source: "h3", routeParams: { id: "42" } });
    }

    {
      const response = await fetch(
        "http://localhost:4125/post-validated-body",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ abc: "123", arr: [1, 2, 3] }),
        }
      );

      const body = await response.json();
      t.match(body, {
        context: {
          method: "POST",
          route: "/post-validated-body",
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
      const response = await fetch(
        "http://localhost:4125/from-node-middleware?abc=123"
      );
      const body = await response.json();
      t.match(body, {
        method: "GET",
        route: "/from-node-middleware",
        source: "h3",
        query: {
          abc: "123",
        },
      });
    }

    {
      const response = await fetch("http://localhost:4125/middleware-2");
      const body = await response.json();
      t.match(body, {
        method: "GET",
        route: "/middleware-2",
        source: "h3",
        query: {},
      });
    }

    {
      const response = await fetch("http://localhost:4125/middleware-3", {
        method: "POST",
        body: JSON.stringify({ abc: "123", arr: [1, 2, 3] }),
        headers: {
          "content-type": "application/json",
        },
      });
      const body = await response.json();
      t.match(body, {
        method: "POST",
        source: "h3",
        route: "/middleware-3",
        query: {},
        body: {
          abc: "123",
          arr: [1, 2, 3],
        },
      });
    }

    {
      const response = await fetch(
        "http://localhost:4126/from-node-middleware?abc=123"
      );
      const body = await response.json();
      t.match(body, {
        method: "GET",
        route: "/from-node-middleware",
        source: "h3",
        query: {
          abc: "123",
        },
      });
    }

    {
      const response = await fetch("http://localhost:4125/from-web-handler");
      const body = await response.json();
      t.match(body, {
        method: "GET",
        route: "/from-web-handler",
        source: "h3",
        query: {},
      });
    }

    {
      const response = await fetch("http://localhost:4125/rate-limited");
      t.equal(response.status, 200);

      const response2 = await fetch("http://localhost:4125/rate-limited");
      t.equal(response2.status, 200);

      const response3 = await fetch("http://localhost:4125/rate-limited");
      t.equal(response3.status, 429);
      t.ok(Number(response3.headers.get("retry-after")) > 0);
      const text = await response3.text();
      t.match(text, /You are rate limited by Zen./);
    }

    {
      const response = await fetch("http://localhost:4125/block-user");
      t.equal(response.status, 403);
      const text = await response.text();
      t.equal(text, "You are blocked by Zen.");
    }

    {
      const response = await fetch("http://localhost:4125/context", {
        headers: {
          cookie: "abc=123; xyz=456",
        },
      });
      const body = await response.json();
      t.match(body, {
        cookies: {
          abc: "123",
          xyz: "456",
        },
      });
    }

    {
      const response = await fetch(
        "http://localhost:4125/from-web-handler?abc=123"
      );
      const body = await response.json();
      t.match(body, {
        method: "GET",
        route: "/from-web-handler",
        source: "h3",
        query: { abc: "123" },
      });
    }

    {
      const headers = { "x-forwarded-for": "4.3.2.1" };
      const r1 = await fetch("http://localhost:4125/rate-limited", { headers });
      t.equal(r1.status, 200);
      const r2 = await fetch("http://localhost:4125/rate-limited", { headers });
      t.equal(r2.status, 200);
      const r3 = await fetch("http://localhost:4125/rate-limited", { headers });
      t.equal(r3.status, 200);
    }

    {
      const response = await fetch("http://localhost:4126/from-web-handler");
      const body = await response.json();
      t.match(body, {
        method: "GET",
        source: "h3",
      });
    }

    {
      await fetch("http://localhost:4126/error");
      t.match(onErrorContext, { source: "h3" });
    }

    server.close();
    server2.close();
  }
);

t.test(
  "handlers and middleware are not wrapped twice",
  {
    skip,
  },
  async (t) => {
    const { defineEventHandler, createApp } =
      require("h3") as typeof import("h3");

    const handler = () => "ok";
    const config = { handler, onRequest: () => {} };

    const first = defineEventHandler(config);
    const wrappedHandler = config.handler;
    const wrappedOnRequest = config.onRequest;
    t.not(wrappedHandler, handler);
    t.ok(isWrapped(wrappedHandler));

    const second = defineEventHandler(config);
    t.equal(config.handler, wrappedHandler);
    t.equal(config.onRequest, wrappedOnRequest);
    t.ok(first);
    t.ok(second);

    const onRequest = () => {};
    const appConfig = { onRequest };
    createApp(appConfig);
    const wrappedAppOnRequest = appConfig.onRequest;
    t.ok(isWrapped(wrappedAppOnRequest));
    createApp(appConfig);
    t.equal(appConfig.onRequest, wrappedAppOnRequest);
    t.equal(getOriginal(appConfig.onRequest), onRequest);
  }
);

t.test(
  "a malformed host header does not break the request",
  {
    skip,
  },
  async (t) => {
    const { createApp, defineEventHandler, toNodeListener } =
      require("h3") as typeof import("h3");
    const http = require("http") as typeof import("http");

    const app = createApp();
    app.use(
      defineEventHandler(() => {
        const context = getContext();
        return { source: context?.source, url: context?.url };
      })
    );

    const server = http.createServer(toNodeListener(app));
    await new Promise<void>((resolve) => server.listen(4127, resolve));

    const { status, body } = await new Promise<{
      status: number | undefined;
      body: string;
    }>((resolve, reject) => {
      const req = http.request(
        { port: 4127, path: "/some/path?a=1", headers: { host: "a b" } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on("error", reject);
      req.end();
    });

    t.equal(status, 200);
    t.same(JSON.parse(body), { source: "h3", url: "/some/path?a=1" });

    server.close();
  }
);
