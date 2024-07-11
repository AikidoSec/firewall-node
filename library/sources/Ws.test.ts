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
import { Express } from "./Express";

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
agent.start([new Ws(), new FileSystem(), new HTTPServer(), new Express()]);
setInstance(agent);

import { WebSocketServer, WebSocket } from "ws";
import { Context, getContext } from "../agent/Context";
import { createServer, Server } from "http";
import { onWsData } from "./ws/wrapSocketEvents";
import { AddressInfo } from "net";

// Method to run a sample WebSocket server with different configurations
function runServer(
  useHttpServer: boolean,
  eventListenerType: "on" | "addEventListener" | "onlong" = "on"
) {
  let wss: WebSocketServer;
  let httpServer: Server | undefined;
  if (!useHttpServer) {
    wss = new WebSocketServer({ port: 0 });
  } else {
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });
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
  };

  if (eventListenerType === "addEventListener") {
    wss.addListener("connection", onEvent);
  } else {
    wss.on("connection", onEvent);
  }

  if (httpServer) {
    httpServer.listen(0);
  }

  return {
    port: (wss.address() as AddressInfo).port,
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
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

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
      ws: { test: "test1" },
    });

    ws.close();
    t.end();
  });
});

t.test("Connect to WebSocket server and send buffer", (t) => {
  const ws = new WebSocket(`ws://localhost:${testServer1.port}`);

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

// We use the function directly to test because the websocket client converts blobs to array buffers
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
    testServer4.close();
    t.end();
  });
});
