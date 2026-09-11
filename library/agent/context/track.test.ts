import * as t from "tap";
import { createTestAgent } from "../../helpers/createTestAgent";
import { ReportingAPIForTesting } from "../api/ReportingAPIForTesting";
import { Token } from "../api/Token";
import { type Context, runWithContext } from "../Context";
import { bypassRequest } from "./bypassRequest";
import { track } from "./track";

function createContext(): Context {
  return {
    remoteAddress: "1.2.3.4",
    method: "POST",
    url: "http://localhost:4000/track-me?token=secret&email=user@example.com",
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
        method: "POST",
        ipAddress: "1.2.3.4",
        userAgent: "test-agent",
        source: "express",
        route: "/track-me",
      },
      user: { id: "user-1", name: "Jane Doe" },
    },
  ]);

  const [event] = api.getEvents();
  t.equal(event.type, "custom");
  if (event.type !== "custom") {
    return;
  }
  t.notOk("url" in event.request);
  t.same(typeof event.time, "number");
});

t.test("it does not send events for bypassed requests", async (t) => {
  for (const bypass of ["IP", "programmatic SDK"] as const) {
    const api = new ReportingAPIForTesting();
    const agent = createTestAgent({ api, token: new Token("abc123") });
    const context = createContext();

    if (bypass === "IP") {
      agent.getConfig().updateConfig([], 0, [], ["1.2.3.4"]);
    }

    runWithContext(context, () => {
      if (bypass === "programmatic SDK") {
        bypassRequest();
      }
      track("my-custom-event");
    });

    t.same(api.getEvents(), [], bypass);
  }
});
