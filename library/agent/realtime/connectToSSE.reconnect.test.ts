import * as t from "tap";
import { createServer, type ServerResponse } from "http";
import { Token } from "../api/Token";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { connectToSSE } from "./connectToSSE";

t.test("it reconnects when server closes connection", async (t) => {
  let connectionCount = 0;
  let sseRes: ServerResponse | null = null;

  const server = createServer((_req, res) => {
    connectionCount++;
    sseRes = res;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": ping\n\n");
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  process.env.AIKIDO_REALTIME_ENDPOINT = `http://localhost:${port}/`;

  try {
    connectToSSE({
      token: new Token("test-token"),
      logger: new LoggerForTesting(),
      onEvent() {},
    });

    await new Promise((r) => setTimeout(r, 200));
    t.equal(connectionCount, 1);

    sseRes!.end();

    // Wait for reconnect (initial delay is 5s + up to 2.5s jitter)
    await new Promise((r) => setTimeout(r, 8000));

    t.equal(connectionCount, 2);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
