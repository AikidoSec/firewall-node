import * as t from "tap";
import { createServer } from "http";
import { Token } from "../api/Token";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { connectToSSE } from "./connectToSSE";

t.test("it sends Authorization header", async (t) => {
  let receivedAuth: string | undefined;

  const server = createServer((req, res) => {
    receivedAuth = req.headers.authorization;
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
      token: new Token("my-secret-token"),
      logger: new LoggerForTesting(),
      onEvent() {},
    });

    await new Promise((r) => setTimeout(r, 200));

    t.equal(receivedAuth, "my-secret-token");
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
