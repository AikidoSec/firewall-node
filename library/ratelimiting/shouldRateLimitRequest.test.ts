import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Endpoint } from "../agent/Config";
import type { Context } from "../agent/Context";
import { shouldRateLimitRequest } from "./shouldRateLimitRequest";
import { createTestAgent } from "../helpers/createTestAgent";

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
  const agent = createTestAgent({
    block: false,
    token: new Token("123"),
    api: new ReportingAPIForTesting({
      allowedIPAddresses: allowedIpAddresses,
      success: true,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
      configUpdatedAt: 0,
      endpoints: endpoints,
    }),
  });

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

t.test("it rate limits by user also if ip is set", async (t) => {
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

  t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
    block: true,
    trigger: "user",
  });
});

t.test("it rate limits by user with different ips", async (t) => {
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

  t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("4.3.2.1", "123"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
    block: false,
  });
  t.same(shouldRateLimitRequest(createContext("4.3.2.1", "123"), agent), {
    block: true,
    trigger: "user",
  });
});

t.test(
  "it does not rate limit requests from same ip but different users",
  async (t) => {
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

    t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
      block: false,
    });
    t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123456"), agent), {
      block: false,
    });
    t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
      block: false,
    });
    t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123456"), agent), {
      block: false,
    });
  }
);

t.test(
  "it does not rate limit requests from allowed ip with user",
  async (t) => {
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

    t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
      block: false,
    });
    t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
      block: false,
    });
    t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
      block: false,
    });
    t.same(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
      block: false,
    });
  }
);

t.test(
  "it does not consume rate limit for user a second time (same request)",
  async (t) => {
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

    const ctx = createContext("1.2.3.4", "123");

    t.same(shouldRateLimitRequest(ctx, agent), {
      block: false,
    });
    t.same(shouldRateLimitRequest(ctx, agent), {
      block: false,
    });
    t.same(shouldRateLimitRequest(ctx, agent), {
      block: false,
    });
    t.same(shouldRateLimitRequest(ctx, agent), {
      block: false,
    });
  }
);

t.test(
  "it does work if setUser is called after first rate limit check",
  async (t) => {
    const agent = await createAgent([
      {
        method: "POST",
        route: "/login",
        forceProtectionOff: false,
        rateLimiting: {
          enabled: true,
          maxRequests: 2,
          windowSizeInMS: 1000,
        },
      },
    ]);

    // Reqest 1
    const ctx1 = createContext("1.2.3.4");
    t.same(shouldRateLimitRequest(ctx1, agent), {
      block: false,
    });
    ctx1.user = { id: "123" };
    t.same(shouldRateLimitRequest(ctx1, agent), {
      block: false,
    });

    // Request 2
    const ctx2 = createContext("1.2.3.4");
    t.same(shouldRateLimitRequest(ctx2, agent), {
      block: false,
    });
    ctx2.user = { id: "123" };
    t.same(shouldRateLimitRequest(ctx2, agent), {
      block: false,
    });

    // Request 3
    const ctx3 = createContext("1.2.3.4");
    t.same(shouldRateLimitRequest(ctx3, agent), {
      block: false,
    });
    ctx3.user = { id: "123" };
    t.same(shouldRateLimitRequest(ctx3, agent), {
      block: true,
      trigger: "user",
    });
  }
);
