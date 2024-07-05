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
import * as express from "express";
import { getContext } from "../agent/Context";
import { createServer, Server } from "http";

function runServer(useHttpServer: "express" | "http" | false) {
  let wss: WebSocketServer;
  let httpServer: Server | undefined;
  if (!useHttpServer) {
    wss = new WebSocketServer({ port: 3003 });
  } else if (useHttpServer === "http") {
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });
  } else if (useHttpServer === "express") {
    const app = express();
    httpServer = createServer(app);
    wss = new WebSocketServer({ server: httpServer });
  } else {
    throw new Error("Invalid useHttpServer test option");
  }

  wss.on("connection", function connection(ws) {
    // Context is available here

    ws.on("message", function message(data) {
      console.log("Server received message", data.toString());

      // Context is not available here

      if (data.toString() === "getContext") {
        ws.send(JSON.stringify(getContext()));
      }
    });

    ws.send("Welcome!");
  });

  if (httpServer) {
    httpServer.listen(3003);
  }

  return function closeServer() {
    wss.close();
    if (httpServer) {
      httpServer.close();
    }
  };
}

const stop = runServer(false);

t.test("Connect to WebSocket server", async (t) => {
  const ws = new WebSocket("ws://localhost:3003");

  ws.on("open", function open() {
    ws.send("getContext");
  });

  ws.on("message", function incoming(data) {
    console.log("Client received data", data.toString());

    ws.close();

    stop();
  });
});
