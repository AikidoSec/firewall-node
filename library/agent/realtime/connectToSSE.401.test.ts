import t from "tap";
import { setTimeout } from "node:timers/promises";
import { createServer } from "http";
import { Token } from "../api/Token";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { connectToSSE } from "./connectToSSE";

t.test("it stops reconnecting on 401", async (t) => {
  let connectionCount = 0;

  const server = createServer((_req, res) => {
    connectionCount++;
    res.writeHead(401);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  server.unref();
  server.on("connection", (socket) => socket.unref());
  const port = (server.address() as { port: number }).port;
  process.env.AIKIDO_REALTIME_ENDPOINT = `http://localhost:${port}/`;

  const logger = new LoggerForTesting();

  try {
    connectToSSE({
      token: new Token("bad-token"),
      logger,
      onEvent() {},
    });

    await setTimeout(500);

    t.equal(connectionCount, 1);
    t.equal(logger.getMessages().length, 1);
    t.match(
      logger.getMessages()[0],
      /SSE connection rejected with status 401, stopping/
    );
  } finally {
    server.close();
  }
});
