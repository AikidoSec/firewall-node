import { parse, ExecutionArgs } from "graphql";
import * as t from "tap";
import { ReportingAPIForTesting } from "../../agent/api/ReportingAPIForTesting";
import { Token } from "../../agent/api/Token";
import { Context } from "../../agent/Context";
import { shouldRateLimitOperation } from "./shouldRateLimitOperation";
import { createTestAgent } from "../../helpers/createTestAgent";

type Args = Pick<ExecutionArgs, "document" | "operationName">;

t.test("it does not rate limit if endpoint not found", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
  });

  const args: Args = {
    document: parse(`
      query getUser {
        user {
          id
        }
      }
    `),
  };

  const context: Context = {
    remoteAddress: "1.2.3.4",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/graphql",
  };

  for (let i = 0; i < 5; i++) {
    t.same(shouldRateLimitOperation(agent, context, args), {
      block: false,
    });
  }
});

t.test("it rate limits query", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    api: new ReportingAPIForTesting({
      success: true,
      endpoints: [
        {
          method: "POST",
          route: "/graphql",
          forceProtectionOff: false,
          rateLimiting: {
            enabled: true,
            maxRequests: 3,
            windowSizeInMS: 60 * 1000,
          },
          graphql: {
            name: "user",
            type: "query",
          },
        },
      ],
      allowedIPAddresses: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
    }),
  });

  agent.start([]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const args: Args = {
    document: parse(`
      query getUser {
        user {
          id
        }
      }
    `),
  };

  const context: Context = {
    remoteAddress: "1.2.3.4",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/graphql",
  };

  for (let i = 0; i < 3; i++) {
    t.same(shouldRateLimitOperation(agent, context, args), {
      block: false,
    });
  }

  t.match(shouldRateLimitOperation(agent, context, args), {
    block: true,
    operationType: "query",
    source: "ip",
    remoteAddress: "1.2.3.4",
  });
});

t.test("it rate limits mutation", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    api: new ReportingAPIForTesting({
      success: true,
      endpoints: [
        {
          method: "POST",
          route: "/graphql",
          forceProtectionOff: false,
          rateLimiting: {
            enabled: true,
            maxRequests: 3,
            windowSizeInMS: 60 * 1000,
          },
          graphql: {
            name: "signup",
            type: "mutation",
          },
        },
      ],
      allowedIPAddresses: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
    }),
  });

  agent.start([]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const args: Args = {
    document: parse(`
      mutation signup {
        signup(input: { email: "john@acme.come" }) {
          id
        }
      }
    `),
  };

  const context: Context = {
    remoteAddress: "1.2.3.4",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/graphql",
  };

  for (let i = 0; i < 3; i++) {
    t.same(shouldRateLimitOperation(agent, context, args), {
      block: false,
    });
  }

  t.match(shouldRateLimitOperation(agent, context, args), {
    block: true,
    operationType: "mutation",
    source: "ip",
    remoteAddress: "1.2.3.4",
  });
});

t.test("it rate limits by user", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    api: new ReportingAPIForTesting({
      success: true,
      endpoints: [
        {
          method: "POST",
          route: "/graphql",
          forceProtectionOff: false,
          rateLimiting: {
            enabled: true,
            maxRequests: 3,
            windowSizeInMS: 60 * 1000,
          },
          graphql: {
            name: "user",
            type: "query",
          },
        },
      ],
      allowedIPAddresses: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
    }),
  });

  agent.start([]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const args: Args = {
    document: parse(`
      query getUser {
        user {
          id
        }
      }
    `),
  };

  const getContext = (ip: string): Context => ({
    remoteAddress: ip,
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/graphql",
    user: {
      id: "user123",
    },
  });

  for (let i = 0; i < 3; i++) {
    t.same(shouldRateLimitOperation(agent, getContext(`1.2.3.${i}`), args), {
      block: false,
    });
  }

  t.match(shouldRateLimitOperation(agent, getContext(`1.2.3.4`), args), {
    block: true,
    operationType: "query",
    source: "user",
    userId: "user123",
  });
});

t.test("it rate limits user groups", async () => {
  const agent = createTestAgent({
    token: new Token("123"),
    api: new ReportingAPIForTesting({
      success: true,
      endpoints: [
        {
          method: "POST",
          route: "/graphql",
          forceProtectionOff: false,
          rateLimiting: {
            enabled: true,
            maxRequests: 3,
            windowSizeInMS: 60 * 1000,
          },
          graphql: {
            name: "signup",
            type: "mutation",
          },
        },
      ],
      allowedIPAddresses: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
    }),
  });

  agent.start([]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const args: Args = {
    document: parse(`
      mutation signup {
        signup(input: { email: "john@acme.come" }) {
          id
        }
      }
    `),
  };

  const getContext = (
    ip: string,
    userId: string,
    groupId: string
  ): Context => ({
    remoteAddress: ip,
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/graphql",
    user: {
      id: userId,
    },
    rateLimitGroup: groupId,
  });

  for (let i = 0; i < 3; i++) {
    t.same(
      shouldRateLimitOperation(
        agent,
        getContext(`192.1.2.${i}`, i.toString(), "group1"),
        args
      ),
      {
        block: false,
      }
    );
  }

  t.match(
    shouldRateLimitOperation(
      agent,
      getContext("192.1.2.22", "123456", "group1"),
      args
    ),
    {
      block: true,
      source: "group",
    }
  );
  t.match(
    shouldRateLimitOperation(
      agent,
      getContext("192.1.2.24", "123456", "group2"),
      args
    ),
    {
      block: false,
    }
  );
});
