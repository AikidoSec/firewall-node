import { createServer, type ServerResponse } from "node:http";
import * as t from "tap";
import type { Config } from "../Config";
import { Token } from "../api/Token";
import { LoggerNoop } from "../logger/LoggerNoop";
import { listenForConfigUpdates } from "./listenForConfigUpdates";

t.beforeEach(() => {
  delete process.env.AIKIDO_ENDPOINT;
  delete process.env.AIKIDO_REALTIME_ENDPOINT;
});

t.test("it ignores config updates that arrive too fast", async (t) => {
  let configRequests = 0;
  let configUpdates = 0;
  let streamResponse: ServerResponse | undefined;
  let streamConnected: () => void;
  const streamConnection = new Promise<void>((resolve) => {
    streamConnected = resolve;
  });
  let configUpdated: () => void;
  const configUpdate = new Promise<void>((resolve) => {
    configUpdated = resolve;
  });
  const config: Config = {
    configUpdatedAt: 100,
    endpoints: [],
    heartbeatIntervalInMS: 600000,
    blockedUserIds: [],
    excludedUserIdsFromRateLimiting: [],
    allowedIPAddresses: [],
  };
  const server = createServer((req, res) => {
    if (req.url === "/api/runtime/stream") {
      streamResponse = res;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      streamConnected();
      return;
    }

    if (req.url === "/api/runtime/config") {
      configRequests++;
      res.end(JSON.stringify(config));
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  process.env.AIKIDO_ENDPOINT = `http://localhost:${port}/`;
  process.env.AIKIDO_REALTIME_ENDPOINT = `http://localhost:${port}/`;

  t.teardown(() => {
    streamResponse?.end();
    server.close();
  });

  listenForConfigUpdates({
    token: new Token("token"),
    logger: new LoggerNoop(),
    lastUpdatedAt: 0,
    onConfigUpdate() {
      configUpdates++;
      configUpdated();
    },
  });

  await streamConnection;
  for (const configUpdatedAt of [100, 200, 300]) {
    streamResponse!.write(
      `event: config-updated\ndata: ${JSON.stringify({ configUpdatedAt })}\n\n`
    );
  }

  await configUpdate;

  t.equal(configRequests, 1);
  t.equal(configUpdates, 1);
});
