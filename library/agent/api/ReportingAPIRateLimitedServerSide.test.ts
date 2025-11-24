import * as FakeTimers from "@sinonjs/fake-timers";
import * as t from "tap";
import { ReportingAPIForTesting } from "./ReportingAPIForTesting";
import { ReportingAPIRateLimitedServerSide } from "./ReportingAPIRateLimitedServerSide";
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
      library: "firewall-node",
      platform: {
        version: "version",
        arch: "arch",
      },
    },
  };
}

t.test("it stops sending requests if rate limited", async (t) => {
  const clock = FakeTimers.install();

  const api = new ReportingAPIForTesting();
  const rateLimitedAPI = new ReportingAPIRateLimitedServerSide(api);
  const token = new Token("token");

  t.same(await rateLimitedAPI.report(token, generateStartedEvent(), 5000), {
    success: true,
    endpoints: [],
    heartbeatIntervalInMS: 10 * 60 * 1000,
    configUpdatedAt: 0,
    blockedUserIds: [],
    allowedIPAddresses: [],
    blockNewOutgoingRequests: false,
    domains: [],
  });
  t.match(api.getEvents(), [{ type: "started" }]);

  api.setResult({ success: false, error: "timeout" });
  t.same(await rateLimitedAPI.report(token, generateStartedEvent(), 5000), {
    success: false,
    error: "timeout",
  });
  t.match(api.getEvents(), [{ type: "started" }, { type: "started" }]);

  t.same(await rateLimitedAPI.report(token, generateStartedEvent(), 5000), {
    success: false,
    error: "timeout",
  });
  t.match(api.getEvents(), [
    { type: "started" },
    { type: "started" },
    { type: "started" },
  ]);

  api.setResult({ success: false, error: "rate_limited" });
  t.same(await rateLimitedAPI.report(token, generateStartedEvent(), 5000), {
    success: false,
    error: "rate_limited",
  });
  t.match(api.getEvents(), [
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
  ]);

  t.same(await rateLimitedAPI.report(token, generateStartedEvent(), 5000), {
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
  api.setResult({
    success: true,
    endpoints: [],
    heartbeatIntervalInMS: 10 * 60 * 1000,
    configUpdatedAt: 0,
    blockedUserIds: [],
    allowedIPAddresses: [],
  });
  t.same(await rateLimitedAPI.report(token, generateStartedEvent(), 5000), {
    success: true,
    endpoints: [],
    heartbeatIntervalInMS: 10 * 60 * 1000,
    configUpdatedAt: 0,
    blockedUserIds: [],
    allowedIPAddresses: [],
  });
  t.match(api.getEvents(), [
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
    { type: "started" },
  ]);

  api.setResult({ success: false, error: "rate_limited" });
  t.same(await rateLimitedAPI.report(token, generateStartedEvent(), 5000), {
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

  t.same(await rateLimitedAPI.report(token, generateStartedEvent(), 5000), {
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
