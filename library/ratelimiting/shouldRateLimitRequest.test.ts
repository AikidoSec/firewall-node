import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Endpoint } from "../agent/Config";
import type { Context } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { shouldRateLimitRequest } from "./shouldRateLimitRequest";

function createContext(
  remoteAddress: string | undefined = undefined,
  userId: string | undefined = undefined,
  route: string = "/login",
  method: string = "POST"
): Context {
  return {
    remoteAddress: remoteAddress,
    method: method,
    url: `http://localhost${route}`,
    query: {},
    headers: {},
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "express",
    route: route,
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

t.test("it rate limits with wildcard", async () => {
  const agent = await createAgent([
    {
      method: "POST",
      route: "/api/*",
      forceProtectionOff: false,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 1000,
      },
    },
  ]);

  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/api/login"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/api/logout"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/api/reset-password"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/api/login"),
      agent
    ),
    {
      block: true,
      trigger: "ip",
    }
  );
});

t.test("it rate limits with wildcard", async () => {
  const agent = await createAgent([
    {
      method: "*",
      route: "/api/*",
      forceProtectionOff: false,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 1000,
      },
    },
  ]);

  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/api/login", "POST"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/api/logout", "GET"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/api/reset-password", "PUT"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/api/login", "GET"),
      agent
    ),
    {
      block: true,
      trigger: "ip",
    }
  );
});
