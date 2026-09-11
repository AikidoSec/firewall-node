import { Hono } from "hono";
import * as t from "tap";
import { setTimeout } from "node:timers/promises";
import { createTestAgent } from "../../helpers/createTestAgent";
import { Token } from "../api/Token";
import { type Context, runWithContext } from "../Context";
import { getMajorNodeVersion } from "../../helpers/getNodeVersion";
import { track } from "./track";

const opts = {
  skip:
    getMajorNodeVersion() < 18
      ? "@hono/node-server does not support Node.js < 18"
      : false,
};

type SeenRequest = { token: string; body: unknown };
type StopServer = () => Promise<SeenRequest[]>;

async function createTestEndpoint(): Promise<{
  stop: StopServer;
  port: number;
}> {
  const { serve } =
    require("@hono/node-server") as typeof import("@hono/node-server");

  const seen: SeenRequest[] = [];

  const app = new Hono();

  app.post("/api/runtime/events", async (c) => {
    seen.push({
      token: c.req.header("Authorization") || "",
      body: await c.req.json(),
    });
    return c.json({ success: true });
  });

  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: 0 }, (info) => {
      resolve({
        port: info.port,
        stop: () => {
          return new Promise((resolve) => server.close(() => resolve(seen)));
        },
      });
    });
  });
}

function createContext(): Context {
  return {
    remoteAddress: "1.2.3.4",
    method: "POST",
    url: "http://localhost:4000/track-me",
    query: {},
    headers: { "user-agent": "test-agent" },
    body: {},
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/track-me",
  };
}

t.test("it sends the expected payload to the API", opts, async (t) => {
  const { stop, port } = await createTestEndpoint();
  process.env.AIKIDO_REALTIME_ENDPOINT = `http://localhost:${port}/`;

  try {
    const agent = createTestAgent({ token: new Token("abc123") });

    const context = createContext();
    context.user = { id: "user-1", name: "Jane Doe" };

    runWithContext(context, () => {
      track("my-custom-event");
    });

    await agent.getPendingEvents().waitUntilSent(2000);

    const seen = await stop();

    t.same(seen.length, 1);
    t.same(seen[0].token, "abc123");
    const body = seen[0].body as { time: unknown };
    t.match(body, {
      type: "custom",
      name: "my-custom-event",
      request: {
        url: "http://localhost:4000/track-me",
        method: "POST",
        ipAddress: "1.2.3.4",
        userAgent: "test-agent",
        source: "express",
        route: "/track-me",
      },
      user: { id: "user-1", name: "Jane Doe" },
    });
    t.same(typeof body.time, "number");
  } finally {
    delete process.env.AIKIDO_REALTIME_ENDPOINT;
  }
});

t.test("it omits the user agent if it's not a string", opts, async (t) => {
  const { stop, port } = await createTestEndpoint();
  process.env.AIKIDO_REALTIME_ENDPOINT = `http://localhost:${port}/`;

  try {
    const agent = createTestAgent({ token: new Token("abc123") });

    const context = createContext();
    context.headers = { "user-agent": ["a", "b"] };

    runWithContext(context, () => {
      track("another-event");
    });

    await agent.getPendingEvents().waitUntilSent(2000);

    const seen = await stop();

    t.same(seen.length, 1);
    const body = seen[0].body as { request: Record<string, unknown> };
    t.same(body.request.userAgent, undefined);
    t.same("userAgent" in body.request, false);
  } finally {
    delete process.env.AIKIDO_REALTIME_ENDPOINT;
  }
});

t.test("it does not send an event without a token", opts, async (t) => {
  const { stop, port } = await createTestEndpoint();
  process.env.AIKIDO_REALTIME_ENDPOINT = `http://localhost:${port}/`;

  try {
    const agent = createTestAgent();

    runWithContext(createContext(), () => {
      track("no-token-event");
    });

    await agent.getPendingEvents().waitUntilSent(2000);
    await setTimeout(100);

    const seen = await stop();

    t.same(seen.length, 0);
  } finally {
    delete process.env.AIKIDO_REALTIME_ENDPOINT;
  }
});
