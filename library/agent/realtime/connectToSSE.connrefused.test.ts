import * as t from "tap";
import { setTimeout } from "node:timers/promises";
import { createServer } from "http";
import { Token } from "../api/Token";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { connectToSSE } from "./connectToSSE";

t.test("it handles connection refused", async (t) => {
  // Bind and immediately close to get a port that's definitely not in use
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));

  process.env.AIKIDO_REALTIME_ENDPOINT = `http://localhost:${port}/`;
  process.env.AIKIDO_DEBUG_SSE = "true";

  const logger = new LoggerForTesting();

  connectToSSE({
    token: new Token("test-token"),
    logger,
    onEvent() {},
  });

  await setTimeout(500);

  t.ok(logger.getMessages().some((m) => m.includes("SSE connection error:")));
});
