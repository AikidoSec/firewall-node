import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Endpoint } from "../agent/Config";
import type { Context } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { shouldRateLimitRequest } from "./shouldRateLimitRequest";

function createContext(
  remoteAddress: string = undefined,
  userId: string = undefined
): Context {
  return {
    remoteAddress: remoteAddress,
    method: "POST",
    url: "http://localhost/login",
    query: {},
    headers: {},
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/login",
    user: userId ? { id: userId } : undefined,
  };
}

async function createAgent(
  endpoints: Endpoint[] = [],
  allowedIpAddresses: string[] = []
) {
  const agent = new Agent(
    false,
    new LoggerNoop(),
    new ReportingAPIForTesting({
      allowedIPAddresses: allowedIpAddresses,
      success: true,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
      configUpdatedAt: 0,
      endpoints: endpoints,
    }),
    new Token("123"),
    undefined
  );

  agent.start([]);

  await new Promise((resolve) => setTimeout(resolve, 0));

  return agent;
}

t.beforeEach(() => {
  delete process.env.NODE_ENV;
});

t.test("it rate limits by IP", async (t) => {
  const agent = await createAgent([
    {
      method: "POST",
      route: "/login",
      forceProtectionOff: false,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 1000,
      },
    },
  ]);

  t.same(shouldRateLimitRequest(createContext("1.2.3.4"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4"), agent), {
    block: true,
    trigger: "ip",
  });
});

t.test("it does not rate limit localhost in production", async (t) => {
  const agent = await createAgent([
    {
      method: "POST",
      route: "/login",
      forceProtectionOff: false,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 1000,
      },
    },
  ]);

  process.env.NODE_ENV = "production";

  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
});

t.test("it rate limits localhost when not in production mode", async (t) => {
  const agent = await createAgent([
    {
      method: "POST",
      route: "/login",
      forceProtectionOff: false,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 1000,
      },
    },
  ]);

  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: true,
    trigger: "ip",
  });
});

t.test("it rate limits localhost when not in production mode", async (t) => {
  const agent = await createAgent([
    {
      method: "POST",
      route: "/login",
      forceProtectionOff: false,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 1000,
      },
    },
  ]);

  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("::1"), agent), {
    block: true,
    trigger: "ip",
  });
});

t.test("it does not rate limit when the IP is allowed", async (t) => {
  const agent = await createAgent(
    [
      {
        method: "POST",
        route: "/login",
        forceProtectionOff: false,
        rateLimiting: {
          enabled: true,
          maxRequests: 3,
          windowSizeInMS: 1000,
        },
      },
    ],
    ["1.2.3.4"]
  );

  t.same(shouldRateLimitRequest(createContext("1.2.3.4"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4"), agent), {
    block: false,
  });
});

t.test("it rate limits by user", async (t) => {
  const agent = await createAgent([
    {
      method: "POST",
      route: "/login",
      forceProtectionOff: false,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 1000,
      },
    },
  ]);

  t.same(shouldRateLimitRequest(createContext(undefined, "123"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext(undefined, "123"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext(undefined, "123"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext(undefined, "123"), agent), {
    block: true,
    trigger: "user",
  });
});
