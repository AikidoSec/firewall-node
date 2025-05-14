import * as t from "tap";
import { Agent } from "../../agent/Agent";
import { ReportingAPIForTesting } from "../../agent/api/ReportingAPIForTesting";
import { Token } from "../../agent/api/Token";
import { Context } from "../../agent/Context";
import { LoggerNoop } from "../../agent/logger/LoggerNoop";
import { ipAllowedToAccessRoute } from "./ipAllowedToAccessRoute";
import { createTestAgent } from "../../helpers/createTestAgent";

let agent: Agent;
const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000/posts/3",
  query: {},
  headers: {},
  body: undefined,
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.beforeEach(async () => {
  agent = createTestAgent({
    token: new Token("123"),
    api: new ReportingAPIForTesting({
      success: true,
      allowedIPAddresses: [],
      configUpdatedAt: 0,
      blockedUserIds: [],
      heartbeatIntervalInMS: 10 * 1000,
      endpoints: [
        {
          route: "/posts/:id",
          // @ts-expect-error Test
          rateLimiting: undefined,
          method: "POST",
          allowedIPAddresses: ["1.2.3.4", "192.168.2.0/24"],
          forceProtectionOff: false,
        },

        {
          route: "/private/public",
          // @ts-expect-error Test
          rateLimiting: undefined,
          method: "GET",
          allowedIPAddresses: ["0.0.0.0/0", "::/0"],
          forceProtectionOff: false,
        },
        {
          route: "/private/public/*",
          // @ts-expect-error Test
          rateLimiting: undefined,
          method: "GET",
          allowedIPAddresses: ["0.0.0.0/0", "::/0"],
          forceProtectionOff: false,
        },
        {
          route: "/private/*",
          // @ts-expect-error Test
          rateLimiting: undefined,
          method: "GET",
          allowedIPAddresses: ["127.0.0.1", "::1"],
          forceProtectionOff: false,
        },
      ],
      block: true,
    }),
  });

  agent.start([]);

  await new Promise((resolve) => setTimeout(resolve, 0));
});

t.test("it always allows request if not production", async () => {
  t.same(ipAllowedToAccessRoute(context, agent), true);
});

t.test("it always allows request if no match", async () => {
  t.same(
    ipAllowedToAccessRoute(
      { ...context, route: "/", method: "GET", remoteAddress: "1.2.3.4" },
      agent
    ),
    true
  );
});

t.test("it always allows request if allowed IP address", async () => {
  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "1.2.3.4" }, agent),
    true
  );
  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "192.168.2.1" }, agent),
    true
  );
});

t.test("it always allows request if localhost", async () => {
  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "::1" }, agent),
    true
  );
});

t.test("it blocks request if no IP address", async () => {
  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: undefined }, agent),
    false
  );
});

t.test("public subroute of private route", async () => {
  t.same(
    ipAllowedToAccessRoute(
      {
        ...context,
        url: "/private/test",
        route: "/private/test",
        method: "GET",
        remoteAddress: "1.1.1.1",
      },
      agent
    ),
    false
  );
  t.same(
    ipAllowedToAccessRoute(
      {
        ...context,
        url: "/private/public",
        route: "/private/public",
        method: "GET",
        remoteAddress: "1.1.1.1",
      },
      agent
    ),
    true
  );

  // No exact match and not all matching endpoints allow the IP address
  t.same(
    ipAllowedToAccessRoute(
      {
        ...context,
        url: "/private/public/test",
        route: "/private/public/test",
        method: "GET",
        remoteAddress: "1.1.1.1",
      },
      agent
    ),
    false
  );
});

t.test("it allows request if configuration is broken", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    api: new ReportingAPIForTesting({
      success: true,
      allowedIPAddresses: [],
      configUpdatedAt: 0,
      blockedUserIds: [],
      heartbeatIntervalInMS: 10 * 1000,
      endpoints: [
        {
          route: "/posts/:id",
          // @ts-expect-error Test
          rateLimiting: undefined,
          method: "POST",
          // @ts-expect-error We're testing a broken configuration
          allowedIPAddresses: {},
          forceProtectionOff: false,
        },
      ],
      block: true,
    }),
  });

  agent.start([]);

  await new Promise((resolve) => setTimeout(resolve, 0));

  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "3.4.5.6" }, agent),
    true
  );
});

t.test("it allows request if allowed IP addresses is empty", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    api: new ReportingAPIForTesting({
      success: true,
      allowedIPAddresses: [],
      configUpdatedAt: 0,
      blockedUserIds: [],
      heartbeatIntervalInMS: 10 * 1000,
      endpoints: [
        {
          route: "/posts/:id",
          // @ts-expect-error Test
          rateLimiting: undefined,
          method: "POST",
          allowedIPAddresses: [],
          forceProtectionOff: false,
        },
      ],
      block: true,
    }),
  });

  agent.start([]);

  await new Promise((resolve) => setTimeout(resolve, 0));

  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "3.4.5.6" }, agent),
    true
  );
});

t.test("it blocks request if not allowed IP address", async () => {
  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "3.4.5.6" }, agent),
    false
  );
  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "192.168.0.1" }, agent),
    false
  );
});

t.test("it checks every matching endpoint", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    api: new ReportingAPIForTesting({
      success: true,
      allowedIPAddresses: [],
      configUpdatedAt: 0,
      blockedUserIds: [],
      heartbeatIntervalInMS: 10 * 1000,
      endpoints: [
        {
          route: "/posts/:id",
          // @ts-expect-error Test
          rateLimiting: undefined,
          method: "POST",
          allowedIPAddresses: ["3.4.5.6"],
          forceProtectionOff: false,
        },
        {
          route: "/posts/*",
          // @ts-expect-error Test
          rateLimiting: undefined,
          method: "POST",
          allowedIPAddresses: ["1.2.3.4"],
          forceProtectionOff: false,
        },
      ],
      block: true,
    }),
  });

  agent.start([]);

  await new Promise((resolve) => setTimeout(resolve, 0));

  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "3.4.5.6" }, agent),
    true // Because exact match allows the IP address
  );
});

t.test(
  "if allowed IPs is empty or broken, it ignores the endpoint but does check the other ones",
  async () => {
    const agent = createTestAgent({
      token: new Token("123"),
      api: new ReportingAPIForTesting({
        success: true,
        allowedIPAddresses: [],
        configUpdatedAt: 0,
        blockedUserIds: [],
        heartbeatIntervalInMS: 10 * 1000,
        endpoints: [
          {
            route: "/posts/:id",
            // @ts-expect-error Test
            rateLimiting: undefined,
            method: "POST",
            allowedIPAddresses: [],
            forceProtectionOff: false,
          },
          {
            route: "/posts/*",
            // @ts-expect-error Test
            rateLimiting: undefined,
            method: "POST",
            // @ts-expect-error We're testing a broken configuration
            allowedIPAddresses: {},
            forceProtectionOff: false,
          },
          {
            route: "/posts/*",
            // @ts-expect-error Test
            rateLimiting: undefined,
            method: "POST",
            allowedIPAddresses: ["1.2.3.4"],
            forceProtectionOff: false,
          },
        ],
        block: true,
      }),
    });

    agent.start([]);

    await new Promise((resolve) => setTimeout(resolve, 0));

    t.same(
      ipAllowedToAccessRoute(
        {
          ...context,
          remoteAddress: "1.2.3.4",
        },
        agent
      ),
      true
    );

    t.same(
      ipAllowedToAccessRoute(
        {
          ...context,
          remoteAddress: "3.4.5.6",
        },
        agent
      ),
      false
    );
  }
);

t.test(
  "allows all IPs for /api/routes/authorize but restricts /api/routes/* to 1.1.1.1",
  async () => {
    const agent = createTestAgent({
      token: new Token("123"),
      api: new ReportingAPIForTesting({
        success: true,
        allowedIPAddresses: [],
        configUpdatedAt: 0,
        blockedUserIds: [],
        heartbeatIntervalInMS: 10 * 1000,
        endpoints: [
          {
            route: "/api/routes/*",
            // @ts-expect-error Test
            rateLimiting: undefined,
            method: "GET",
            allowedIPAddresses: ["1.1.1.1"],
            forceProtectionOff: false,
          },
          {
            route: "/api/routes/authorize",
            // @ts-expect-error Test
            rateLimiting: undefined,
            method: "GET",
            allowedIPAddresses: ["0.0.0.0/0", "::/0"],
            forceProtectionOff: false,
          },
        ],
        block: true,
      }),
    });

    agent.start([]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // /api/routes/authorize allowed from any IP
    t.same(
      ipAllowedToAccessRoute(
        {
          ...context,
          url: "/api/routes/authorize",
          route: "/api/routes/authorize",
          method: "GET",
          remoteAddress: "8.8.8.8",
        },
        agent
      ),
      true
    );

    // /api/routes/foo only allowed from 1.1.1.1
    t.same(
      ipAllowedToAccessRoute(
        {
          ...context,
          url: "/api/routes/foo",
          route: "/api/routes/foo",
          method: "GET",
          remoteAddress: "1.1.1.1",
        },
        agent
      ),
      true
    );
    t.same(
      ipAllowedToAccessRoute(
        {
          ...context,
          url: "/api/routes/foo",
          route: "/api/routes/foo",
          method: "GET",
          remoteAddress: "8.8.8.8",
        },
        agent
      ),
      false
    );
  }
);
