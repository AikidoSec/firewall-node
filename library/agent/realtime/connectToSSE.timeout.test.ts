import * as t from "tap";
import { createServer } from "http";
import { Token } from "../api/Token";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { connectToSSE } from "./connectToSSE";

t.test("it reconnects on read timeout", async (t) => {
  let connectionCount = 0;

  const server = createServer((_req, res) => {
    connectionCount++;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  server.unref();
  server.on("connection", (socket) => socket.unref());
  const port = (server.address() as { port: number }).port;
  process.env.AIKIDO_REALTIME_ENDPOINT = `http://localhost:${port}/`;

  try {
    connectToSSE({
      token: new Token("test-token"),
      logger: new LoggerForTesting(),
      onEvent() {},
      readTimeoutMs: 200,
      initialReconnectMs: 100,
    });

    await new Promise((r) => setTimeout(r, 200));
    t.equal(connectionCount, 1);

    await new Promise((r) => setTimeout(r, 500));
    t.equal(connectionCount, 2);
  } finally {
    server.close();
  }
});
