import * as t from "tap";
import { createServer, type ServerResponse } from "http";
import { Token } from "../api/Token";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { connectToSSE } from "./connectToSSE";
import type { EventSourceMessage } from "../../helpers/eventsource-parser/types";

t.test(
  "it connects with auth header and receives events, ignoring pings",
  async (t) => {
    let receivedAuth: string | undefined;
    let sseRes: ServerResponse | null = null;

    const server = createServer((req, res) => {
      receivedAuth = req.headers.authorization;
      sseRes = res;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      res.write(": ping\n\n");

      const data = JSON.stringify({ serviceId: 1, configUpdatedAt: 100 });
      res.write(`event: config-updated\ndata: ${data}\n\n`);
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    server.unref();
    server.on("connection", (socket) => socket.unref());
    const port = (server.address() as { port: number }).port;
    process.env.AIKIDO_REALTIME_ENDPOINT = `http://localhost:${port}/`;

    const events: EventSourceMessage[] = [];

    try {
      connectToSSE({
        token: new Token("my-secret-token"),
        logger: new LoggerForTesting(),
        onEvent(event) {
          events.push(event);
        },
      });

      await new Promise((r) => setTimeout(r, 200));

      t.equal(receivedAuth, "my-secret-token");
      t.equal(events.length, 1);
      t.equal(events[0].event, "config-updated");
      t.same(JSON.parse(events[0].data), {
        serviceId: 1,
        configUpdatedAt: 100,
      });

      const data2 = JSON.stringify({ serviceId: 1, configUpdatedAt: 200 });
      sseRes!.write(`event: config-updated\ndata: ${data2}\n\n`);

      await new Promise((r) => setTimeout(r, 100));

      t.equal(events.length, 2);
      t.same(JSON.parse(events[1].data), {
        serviceId: 1,
        configUpdatedAt: 200,
      });
    } finally {
      server.close();
    }
  }
);
