import * as t from "tap";
import { createTestAgent } from "../../helpers/createTestAgent";
import { wrap } from "../../helpers/wrap";
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

t.test(
  "it warns only once when the agent event limit is reached",
  async (t) => {
    const api = new ReportingAPIForTesting({
      success: false,
      error: "max_custom_events_reached",
    });
    const agent = createTestAgent({ api, token: new Token("abc123") });

    const warnings: string[] = [];
    const originalWarn = Reflect.get(console, "warn");
    t.teardown(() => {
      Reflect.set(console, "warn", originalWarn);
    });
    wrap(console, "warn", function warn() {
      return function warn(message: string) {
        warnings.push(message);
      };
    });

    runWithContext(createContext(), () => {
      track("first-event");
      track("second-event");
    });
    await agent.getPendingEvents().waitUntilSent(1000);

    t.equal(warnings.length, 1);
    t.match(warnings[0], "┌──AIKIDO");
    t.match(warnings[0], "Zen is dropping custom events");
  }
);

t.test("it limits tracked events to 25 per request", async (t) => {
  const api = new ReportingAPIForTesting();
  createTestAgent({ api, token: new Token("abc123") });

  const warnings: string[] = [];
  const originalWarn = Reflect.get(console, "warn");
  t.teardown(() => {
    Reflect.set(console, "warn", originalWarn);
  });
  wrap(console, "warn", function warn() {
    return function warn(message: string) {
      warnings.push(message);
    };
  });

  runWithContext(createContext(), () => {
    for (let i = 0; i < 30; i++) {
      track(`event-${i}`);
    }
  });

  runWithContext(createContext(), () => {
    track("event-from-next-request");
  });

  const events = api.getEvents();
  t.equal(events.length, 26);
  t.match(events[25], { name: "event-from-next-request" });
  t.same(warnings, [
    "Zen.track(...) was called more than 25 times during one request. Only the first 25 events were tracked.",
  ]);
});
