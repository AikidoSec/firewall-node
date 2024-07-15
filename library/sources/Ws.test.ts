import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { setUser } from "../agent/context/user";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Ws } from "./Ws";
import { FileSystem } from "../sinks/FileSystem";
import { HTTPServer } from "./HTTPServer";

const agent = new Agent(
  true,
  new LoggerNoop(),
  new ReportingAPIForTesting({
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
  new Token("123"),
  undefined
);
agent.start([new Ws(), new FileSystem(), new HTTPServer()]);
setInstance(agent);

process.env.AIKIDO_MAX_WS_MSG_SIZE_MB = "1";

import { WebSocketServer, WebSocket } from "ws";
import { Context, getContext } from "../agent/Context";
import { createServer, Server } from "http";
import { onWsData } from "./ws/wrapSocketEvents";
import { AddressInfo } from "net";

// Method to run a sample WebSocket server with different configurations
function runServer(
  useHttpServer: boolean,
  eventListenerType: "on" | "addEventListener" | "onlong" | "once" = "on",
  customUpgrade = false
) {
  let wss: WebSocketServer;
  let httpServer: Server | undefined;
  if (!useHttpServer) {
    wss = new WebSocket.Server({ port: 0 });
  } else {
    httpServer = createServer();
    if (!customUpgrade) {
      wss = new WebSocketServer({ server: httpServer });
    } else {
      if (!useHttpServer) {
        throw new Error("Custom upgrade requires http server");
      }
      wss = new WebSocketServer({ noServer: true });
    }
  }

  const onEvent = (ws: WebSocket) => {
    const onMessage = () => {
      ws.send(JSON.stringify(getContext()));
    };

    if (eventListenerType === "addEventListener") {
      ws.addEventListener("message", onMessage, { once: true });
    } else if (eventListenerType === "onlong") {
      ws.onmessage = onMessage;
    } else {
      ws.on("message", onMessage);
    }

    ws.on("ping", (data) => {
      // Send back the context
      ws.send(JSON.stringify(getContext()));
    });

    ws.on("pong", (data) => {
      // Send back the context
      ws.send(JSON.stringify(getContext()));
    });

    ws.on("close", (code, reason) => {
      if (code === 1001 && Buffer.isBuffer(reason) && reason.length) {
        t.same(reason.toString(), getContext()?.ws);
      }
    });
  };

  if (eventListenerType === "addEventListener") {
    wss.addListener("connection", onEvent);
  } else if (eventListenerType === "once") {
    wss.once("connection", onEvent);
  } else {
    wss.on("connection", onEvent);
  }

  if (httpServer) {
    if (customUpgrade) {
      httpServer.on("upgrade", function upgrade(request, socket, head) {
        const { pathname } = new URL(
          request.url || "",
          `http://${request.headers.host}`
        );

        if (pathname === "/block-user") {
          setUser({ id: "567" });
        }

        wss.handleUpgrade(request, socket, head, function done(ws) {
          wss.emit("connection", ws, request);
        });
      });
    }

    httpServer.listen(0);
  }

  return {
    port: !customUpgrade
      ? (wss.address() as AddressInfo).port
      : (httpServer!.address() as AddressInfo).port,
    close: () => {
      wss.close();
      if (httpServer) {
        httpServer.close();
      }
    },
  };
}

const testServer1 = runServer(false);

const getExpectedContext = (port: number) => {
  return {
    url: "/",
    method: "GET",
    headers: {
      "sec-websocket-version": "13",
      connection: "Upgrade",
      upgrade: "websocket",
      "sec-websocket-extensions": "permessage-deflate; client_max_window_bits",
      host: `localhost:${port}`,
    },
    route: "/",
    query: {},
    source: "ws.connection",
    routeParams: {},
    cookies: {},
    body: undefined,
  };
};

t.test("Connect to WebSocket server and get context", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("getContext");
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer1.port),
      ws: "getContext",
    });
    t.match(context.remoteAddress, /(::ffff:127\.0\.0\.1|127\.0\.0\.1|::1)/);

    ws.close();
    t.end();
  });
});

t.test("Connect to WebSocket server and send json object", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}/path?test=abc`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send(JSON.stringify({ test: "test1" }));
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer1.port),
      url: "/path?test=abc",
      query: { test: "abc" },
      ws: { test: "test1" },
    });

    ws.close();
    t.end();
  });
});

t.test("Connect to WebSocket server and send buffer", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`, {
    headers: {
      cookie: "test=cookievalue",
    },
  });

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send(Buffer.from("test-buffer"));
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer1.port),
      ws: "test-buffer",
      cookies: { test: "cookievalue" },
    });

    ws.close();
    t.end();
  });
});

t.test("Connect to WebSocket server and send Uint8Array", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send(new TextEncoder().encode("test-text-encoder"));
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer1.port),
      ws: "test-text-encoder",
    });

    ws.close();
    t.end();
  });
});

t.test("Connect to WebSocket server and send non utf-8 Uint8Array", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send(new Uint8Array([0x80, 0x81, 0x82, 0x83]));
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer1.port),
      ws: undefined,
    });

    ws.close();
    t.end();
  });
});

t.test(
  "Connect to WebSocket server and send text as Blob",
  { skip: !global.Blob ? "Blob is not available" : false },
  (t) => {
    const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

    ws.on("error", (err) => {
      t.fail(err);
    });

    ws.on("open", () => {
      // @ts-expect-error types say we are not allowed to send a Blob?
      ws.send(new Blob(["test-blob"]));
    });

    ws.on("message", (data) => {
      const context = JSON.parse(data.toString());

      t.match(context, {
        ...getExpectedContext(testServer1.port),
        ws: "test-blob",
      });

      ws.close();
      t.end();
    });
  }
);

t.test(
  "Connect to WebSocket server and send binary as Blob",
  { skip: !global.Blob ? "Blob is not available" : false },
  (t) => {
    const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

    ws.on("error", (err) => {
      t.fail(err);
    });

    ws.on("open", () => {
      // @ts-expect-error types say we are not allowed to send a Blob?
      ws.send(new Blob([new Uint8Array([0x80, 0x81, 0x82, 0x83])]));
    });

    ws.on("message", (data) => {
      const context = JSON.parse(data.toString());

      t.match(context, {
        ...getExpectedContext(testServer1.port),
        ws: undefined,
      });

      ws.close();
      t.end();
    });
  }
);

// We use the function directly to test because the websocket client converts blobs to array buffers (depending on the version?)
t.test(
  "Pass text blob to onMessageEvent",
  { skip: !global.Blob ? "Blob is not available" : false },
  async (t) => {
    const context = {
      ...getExpectedContext(testServer1.port),
      remoteAddress: "",
    } as Context;
    await onWsData([new Blob(["test-blob"])], context);
    t.same(context, {
      ...getExpectedContext(testServer1.port),
      remoteAddress: "",
      ws: "test-blob",
    });
  }
);

t.test(
  "Pass binary blob to onMessageEvent",
  { skip: !global.Blob ? "Blob is not available" : false },
  async (t) => {
    const context = {
      ...getExpectedContext(testServer1.port),
      remoteAddress: "",
    } as Context;
    await onWsData(
      [new Blob([new Uint8Array([0x80, 0x81, 0x82, 0x83])])],
      context
    );
    t.match(context, {
      ...getExpectedContext(testServer1.port),
      remoteAddress: "",
      ws: undefined,
    });
  }
);

t.test(
  "Pass too large blob to onMessageEvent",
  { skip: !global.Blob ? "Blob is not available" : false },
  async (t) => {
    const context = {
      ...getExpectedContext(testServer1.port),
      remoteAddress: "",
    } as Context;
    await onWsData([new Blob(["a".repeat(2 * 1024 * 1024)])], context);
    t.match(context, {
      ...getExpectedContext(testServer1.port),
      remoteAddress: "",
      ws: undefined,
    });
  }
);

t.test("Pass buffer array to onMessageEvent", async (t) => {
  const context = {
    ...getExpectedContext(testServer1.port),
    remoteAddress: "",
  } as Context;
  await onWsData(
    [[Buffer.from("test-buffer-1"), Buffer.from("test-buffer-2")]],
    context
  );
  t.match(context, {
    ...getExpectedContext(testServer1.port),
    remoteAddress: "",
    ws: "test-buffer-1test-buffer-2",
  });
});

t.test("Pass buffer array with non utf-8 to onMessageEvent", async (t) => {
  const context = {
    ...getExpectedContext(testServer1.port),
    remoteAddress: "",
  } as Context;
  await onWsData(
    [[Buffer.from("test-buffer-1"), Buffer.from([0x80, 0x81, 0x82, 0x83])]],
    context
  );
  t.match(context, {
    ...getExpectedContext(testServer1.port),
    remoteAddress: "",
    ws: undefined,
  });
});

t.test("Pass too large buffer array to onMessageEvent", async (t) => {
  const context = {
    ...getExpectedContext(testServer1.port),
    remoteAddress: "",
  } as Context;
  await onWsData([[Buffer.from("a".repeat(2 * 1024 * 1024))]], context);
  t.match(context, {
    ...getExpectedContext(testServer1.port),
    remoteAddress: "",
    ws: undefined,
  });
});

t.test("Pass unexpected data to onMessageEvent is ignored", async (t) => {
  const context = {
    ...getExpectedContext(testServer1.port),
    remoteAddress: "",
  } as Context;
  await onWsData(
    [[new Date(), 123, { test: "test" }, null, undefined]],
    context
  );
  t.match(context, {
    ...getExpectedContext(testServer1.port),
    remoteAddress: "",
    ws: undefined,
  });
});

t.test("Send ping with data to WebSocket server", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.ping("test-ping");
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer1.port),
      ws: "test-ping",
    });

    ws.close();
    t.end();
  });
});

t.test("Send close with data to WebSocket server", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.close(1001, "test-close");
    t.end();
  });
});

t.test("Send close with data in buffer to WebSocket server", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.close(1001, Buffer.from("test-close"));
    t.end();
  });
});

t.test("Send pong with data to WebSocket server", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.pong(JSON.stringify({ test: "pong" }));
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer1.port),
      ws: { test: "pong" },
    });

    ws.close();
    testServer1.close();
    t.end();
  });
});

const testServer2 = runServer(true);

t.test("Send message to WebSocket server with http server", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer2.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("getContextHTTP");
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer2.port),
      ws: "getContextHTTP",
    });

    t.match(context.remoteAddress, /(::ffff:127\.0\.0\.1|127\.0\.0\.1|::1)/);

    ws.close();
    testServer2.close();
    t.end();
  });
});

const testServer3 = runServer(false, "addEventListener");

t.test("Send message to WebSocket server using addEventListener", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer3.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("getContextEvent");
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer3.port),
      ws: "getContextEvent",
    });
    t.match(context.remoteAddress, /(::ffff:127\.0\.0\.1|127\.0\.0\.1|::1)/);

    ws.close();
    testServer3.close();
    t.end();
  });
});

const testServer4 = runServer(false, "onlong");

t.test("Send message to WebSocket server using onmessage", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer4.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("getContextOnMessage");
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer4.port),
      ws: "getContextOnMessage",
    });
    t.match(context.remoteAddress, /(::ffff:127\.0\.0\.1|127\.0\.0\.1|::1)/);

    ws.close();
    t.end();
  });
});

t.test("Send more than 2MB of data to WebSocket server", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer4.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("a".repeat(2.5 * 1024 * 1024));
  });

  ws.on("message", (data) => {
    t.match(
      data.toString(),
      "WebSocket message size exceeded the maximum allowed size. Use AIKIDO_MAX_WS_MSG_SIZE_MB to increase the limit."
    );
    ws.close();
    testServer4.close();
    t.end();
  });
});

// Custom http upgrade
const testServer5 = runServer(true, "on", true);

t.test("Test custom http upgrade", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer5.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("getContextOnMessage");
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer5.port),
      ws: "getContextOnMessage",
    });

    ws.close();
    t.end();
  });
});

t.test("Test block user on custom http upgrade", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer5.port}/block-user`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("Hi!");
  });

  ws.on("close", (code, reason) => {
    t.same(code, 3000);
    t.match(reason.toString(), /You are blocked by Aikido firewall/);

    ws.close();
    t.end();
  });
});

t.test("Test rate limiting on WebSocket server - 1st request", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer5.port}/rate-limited`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("getContextOnMessage");
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer5.port),
      ws: "getContextOnMessage",
    });

    ws.close();
    t.end();
  });
});

t.test("Test rate limiting on WebSocket server - 2nd request", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer5.port}/rate-limited`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("getContextOnMessage");
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer5.port),
      ws: "getContextOnMessage",
    });

    ws.close();

    t.end();
  });
});

t.test("Test rate limiting on WebSocket server - 3rd request", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer5.port}/rate-limited`);

  ws.on("unexpected-response", (req, res) => {
    t.same(res.statusCode, 429);
    t.same(res.statusMessage, "Too Many Requests");
    testServer5.close();
    t.end();
  });
});

// Check once
const testServer6 = runServer(false, "once", false);

t.test("Send message to WebSocket server using once", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer6.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("getContextOnce");
  });

  ws.on("message", (data) => {
    const context = JSON.parse(data.toString());

    t.match(context, {
      ...getExpectedContext(testServer6.port),
      ws: "getContextOnce",
    });
    t.match(context.remoteAddress, /(::ffff:127\.0\.0\.1|127\.0\.0\.1|::1)/);

    ws.close();
    t.end();
  });
});

t.test("Send message to WebSocket server using once - 2nd request", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer6.port}`);

  ws.on("error", (err) => {
    t.fail(err);
  });

  ws.on("open", () => {
    ws.send("getContextOnce");

    setTimeout(() => {
      ws.close();
      testServer6.close();
      t.end();
    }, 150);
  });

  ws.on("message", (data) => {
    t.fail("Should not receive message");
  });
});
