import * as t from "tap";
import { Agent } from "../../agent/Agent";
import { ReportingAPIForTesting } from "../../agent/api/ReportingAPIForTesting";
import { Token } from "../../agent/api/Token";
import { Context } from "../../agent/Context";
import { LoggerNoop } from "../../agent/logger/LoggerNoop";
import { ipAllowedToAccessRoute } from "./ipAllowedToAccessRoute";

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
  agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting({
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
          allowedIPAddresses: ["1.2.3.4"],
          forceProtectionOff: false,
        },
      ],
      block: true,
    }),
    new Token("123"),
    undefined
  );

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

t.test("it allows request if configuration is broken", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting({
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
    new Token("123"),
    undefined
  );

  agent.start([]);

  await new Promise((resolve) => setTimeout(resolve, 0));

  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "3.4.5.6" }, agent),
    true
  );
});

t.test("it allows request if allowed IP addresses is empty", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting({
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
    new Token("123"),
    undefined
  );

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
});

t.test("it checks every matching endpoint", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting({
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
    new Token("123"),
    undefined
  );

  agent.start([]);

  await new Promise((resolve) => setTimeout(resolve, 0));

  t.same(
    ipAllowedToAccessRoute({ ...context, remoteAddress: "3.4.5.6" }, agent),
    false
  );
});

t.test(
  "if allowed IPs is empty or broken, it ignores the endpoint but does check the other ones",
  async () => {
    const agent = new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting({
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
      new Token("123"),
      undefined
    );

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
