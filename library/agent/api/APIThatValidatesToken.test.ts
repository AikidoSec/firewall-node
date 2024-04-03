import * as t from "tap";
import { APIForTesting } from "./APIForTesting";
import { APIThatValidatesToken } from "./APIThatValidatesToken";
import { Event } from "./Event";
import { Token } from "./Token";

function generateStartedEvent(): Event {
  return {
    type: "started",
    time: Date.now(),
    agent: {
      version: "1.0.0",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      preventedPrototypePollution: false,
      nodeEnv: "",
      os: {
        name: "os",
        version: "version",
      },
      incompatiblePackages: {
        prototypePollution: {},
      },
      stack: [],
      serverless: false,
    },
  };
}

t.test("it ignores valid tokens", async () => {
  const api = new APIForTesting();
  const validatesToken = new APIThatValidatesToken(api);
  const token = new Token("123");

  const event = generateStartedEvent();
  t.same(await validatesToken.report(token, event, 5000), { success: true });
  t.same(api.getEvents(), [event]);

  t.same(await validatesToken.report(token, event, 5000), { success: true });
  t.same(api.getEvents(), [event, event]);
});

t.test("it stops sending requests if token is invalid", async () => {
  const api = new APIForTesting({ success: false, error: "invalid_token" });
  const validatesToken = new APIThatValidatesToken(api);
  const token = new Token("123");

  const event = generateStartedEvent();
  t.same(await validatesToken.report(token, event, 5000), {
    success: false,
    error: "invalid_token",
  });
  t.same(api.getEvents(), [event]);

  t.same(await validatesToken.report(token, event, 5000), {
    success: false,
    error: "invalid_token",
  });
  t.same(api.getEvents(), [event]);
});

t.test("it ignores other errors", async () => {
  const api = new APIForTesting({ success: false, error: "timeout" });
  const validatesToken = new APIThatValidatesToken(api);
  const token = new Token("123");

  const event = generateStartedEvent();
  t.same(await validatesToken.report(token, event, 5000), {
    success: false,
    error: "timeout",
  });
  t.same(api.getEvents(), [event]);

  t.same(await validatesToken.report(token, event, 5000), {
    success: false,
    error: "timeout",
  });
  t.same(api.getEvents(), [event, event]);
});
