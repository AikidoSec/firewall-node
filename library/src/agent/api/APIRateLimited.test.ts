import * as FakeTimers from "@sinonjs/fake-timers";
import * as t from "tap";
import { APIForTesting } from "./APIForTesting";
import { APIRateLimited } from "./APIRateLimited";
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
      serverless: false,
    },
  };
}

t.test("it stops sending requests if rate limited", async (t) => {
  const clock = FakeTimers.install();

  const api = new APIForTesting();
  const rateLimitedAPI = new APIRateLimited(api);
  const token = new Token("token");

  t.same(await rateLimitedAPI.report(token, generateStartedEvent()), {
    success: true,
  });
  t.match(api.getEvents(), [{ type: "started" }]);

  api.setResult({ success: false, error: "timeout" });
  t.same(await rateLimitedAPI.report(token, generateStartedEvent()), {
    success: false,
    error: "timeout",
  });
  t.match(api.getEvents(), [{ type: "started" }, { type: "started" }]);

  t.same(await rateLimitedAPI.report(token, generateStartedEvent()), {
    success: false,
    error: "timeout",
  });
  t.match(api.getEvents(), [
    { type: "started" },
    { type: "started" },
    { type: "started" },
  ]);

  api.setResult({ success: false, error: "rate_limited" });
  t.same(await rateLimitedAPI.report(token, generateStartedEvent()), {
    success: false,
    error: "rate_limited",
  });
  t.match(api.getEvents(), [
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
  ]);

  t.same(await rateLimitedAPI.report(token, generateStartedEvent()), {
    success: false,
    error: "rate_limited",
  });
  t.match(api.getEvents(), [
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
  ]);

  clock.tick(30 * 60 * 1000);
  api.setResult({ success: true });
  t.same(await rateLimitedAPI.report(token, generateStartedEvent()), {
    success: true,
  });
  t.match(api.getEvents(), [
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
  ]);

  api.setResult({ success: false, error: "rate_limited" });
  t.same(await rateLimitedAPI.report(token, generateStartedEvent()), {
    success: false,
    error: "rate_limited",
  });
  t.match(api.getEvents(), [
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
  ]);

  t.same(await rateLimitedAPI.report(token, generateStartedEvent()), {
    success: false,
    error: "rate_limited",
  });
  t.match(api.getEvents(), [
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
  ]);

  clock.uninstall();
});
