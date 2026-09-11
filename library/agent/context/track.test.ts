import * as t from "tap";
import { createTestAgent } from "../../helpers/createTestAgent";
import { ReportingAPIForTesting } from "../api/ReportingAPIForTesting";
import { Token } from "../api/Token";
import { type Context, runWithContext } from "../Context";
import { track } from "./track";

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

t.test("it sends the expected payload to the API", async (t) => {
  const api = new ReportingAPIForTesting();
  createTestAgent({ api, token: new Token("abc123") });

  const context = createContext();
  context.user = { id: "user-1", name: "Jane Doe" };

  runWithContext(context, () => {
    track("my-custom-event");
  });

  t.match(api.getEvents(), [
    {
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
    },
  ]);
  t.same(typeof api.getEvents()[0].time, "number");
});

t.test("it omits the user agent if it's not a string", async (t) => {
  const api = new ReportingAPIForTesting();
  createTestAgent({ api, token: new Token("abc123") });

  const context = createContext();
  context.headers = { "user-agent": ["a", "b"] };

  runWithContext(context, () => {
    track("another-event");
  });

  t.same(api.getEvents().length, 1);
  const event = api.getEvents()[0] as { request: Record<string, unknown> };
  t.same(event.request.userAgent, undefined);
});

t.test("it does not send an event without a token", async (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({ api });

  runWithContext(createContext(), () => {
    track("no-token-event");
  });

  await agent.getPendingEvents().waitUntilSent(2000);

  t.same(api.getEvents().length, 0);
});
