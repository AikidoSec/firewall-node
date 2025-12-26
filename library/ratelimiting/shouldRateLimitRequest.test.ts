import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { EndpointConfig } from "../agent/Config";
import type { Context } from "../agent/Context";
import { shouldRateLimitRequest } from "./shouldRateLimitRequest";
import { createTestAgent } from "../helpers/createTestAgent";
import { wrap } from "../helpers/wrap";

function createContext(
  remoteAddress: string | undefined = undefined,
  userId: string | undefined = undefined,
  route: string = "/login",
  method: string = "POST",
  rateLimitGroup: string | undefined = undefined
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
    rateLimitGroup,
  };
}

const logs: string[] = [];
wrap(console, "warn", function warn() {
  return function warn(message: string) {
    logs.push(message);
  };
});

async function createAgent(
  endpoints: EndpointConfig[] = [],
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
  t.match(shouldRateLimitRequest(createContext("1.2.3.4"), agent), {
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
  t.match(shouldRateLimitRequest(createContext("::1"), agent), {
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
  t.match(shouldRateLimitRequest(createContext("::1"), agent), {
    block: true,
    trigger: "ip",
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
  t.match(shouldRateLimitRequest(createContext(undefined, "123"), agent), {
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
  t.match(
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
  t.match(
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
  t.match(shouldRateLimitRequest(createContext("1.2.3.4", "123"), agent), {
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
  t.match(shouldRateLimitRequest(createContext("4.3.2.1", "123"), agent), {
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

    t.same(logs, []);

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

    t.same(logs, []);
  }
);

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

  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", "123", "/login", "POST", "group1"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("4.3.2.1", "123", "/login", "POST", "group1"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", "123", "/login", "POST", "group1"),
      agent
    ),
    {
      block: false,
    }
  );
  t.match(
    shouldRateLimitRequest(
      createContext("4.3.2.1", "123", "/login", "POST", "group1"),
      agent
    ),
    {
      block: true,
      trigger: "group",
    }
  );
});

t.test("it rate limits different users in same group", async (t) => {
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

  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", "123", "/login", "POST", "group1"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("4.3.2.1", "456", "/login", "POST", "group1"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", "789", "/login", "POST", "group1"),
      agent
    ),
    {
      block: false,
    }
  );
  t.match(
    shouldRateLimitRequest(
      createContext("4.3.2.1", "101112", "/login", "POST", "group1"),
      agent
    ),
    {
      block: true,
      trigger: "group",
    }
  );
});

t.test(
  "it works with multiple rate limit groups and different users",
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

    t.same(
      shouldRateLimitRequest(
        createContext("1.2.3.4", "123", "/login", "POST", "group1"),
        agent
      ),
      {
        block: false,
      }
    );
    t.same(
      shouldRateLimitRequest(
        createContext("1.2.3.4", "789", "/login", "POST", "group1"),
        agent
      ),
      {
        block: false,
      }
    );
    t.same(
      shouldRateLimitRequest(
        createContext("4.3.2.1", "101112", "/login", "POST", "group2"),
        agent
      ),
      {
        block: false,
      }
    );
    t.match(
      shouldRateLimitRequest(
        createContext("1.2.3.4", "789", "/login", "POST", "group1"),
        agent
      ),
      {
        block: true,
        trigger: "group",
      }
    );
    t.match(
      shouldRateLimitRequest(
        createContext("1.2.3.4", "4321", "/login", "POST", "group1"),
        agent
      ),
      {
        block: true,
        trigger: "group",
      }
    );
    t.same(
      shouldRateLimitRequest(
        createContext("4.3.2.1", "953", "/login", "POST", "group2"),
        agent
      ),
      {
        block: false,
      }
    );
    t.match(
      shouldRateLimitRequest(
        createContext("4.3.2.1", "1563", "/login", "POST", "group2"),
        agent
      ),
      {
        block: true,
        trigger: "group",
      }
    );
  }
);

t.test("it rate limits by group if user is not set", async (t) => {
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

  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/login", "POST", "group1"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("4.3.2.1", undefined, "/login", "POST", "group1"),
      agent
    ),
    {
      block: false,
    }
  );
  t.same(
    shouldRateLimitRequest(
      createContext("1.2.3.4", undefined, "/login", "POST", "group1"),
      agent
    ),
    {
      block: false,
    }
  );
  t.match(
    shouldRateLimitRequest(
      createContext("4.3.2.1", undefined, "/login", "POST", "group1"),
      agent
    ),
    {
      block: true,
      trigger: "group",
    }
  );
});
