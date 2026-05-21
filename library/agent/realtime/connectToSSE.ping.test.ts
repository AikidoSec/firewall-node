import * as t from "tap";
import { createServer } from "http";
import { Token } from "../api/Token";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { connectToSSE } from "./connectToSSE";
import type { EventSourceMessage } from "../../helpers/eventsource-parser/types";

t.test("it receives pings without emitting events", async (t) => {
  const server = createServer((_req, res) => {
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

  const events: EventSourceMessage[] = [];

  try {
    connectToSSE({
      token: new Token("test-token"),
      logger: new LoggerForTesting(),
      onEvent(event) {
        events.push(event);
      },
    });

    await new Promise((r) => setTimeout(r, 200));

    t.equal(events.length, 0);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
