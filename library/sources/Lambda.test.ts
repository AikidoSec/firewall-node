import * as FakeTimers from "@sinonjs/fake-timers";
import type { Context } from "aws-lambda";
import * as t from "tap";
import { setTimeout } from "timers/promises";
import type { Event } from "../agent/api/Event";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { getContext } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { wrap } from "../helpers/wrap";
import {
  APIGatewayProxyEvent,
  createLambdaWrapper,
  getFlushEveryMS,
  getTimeoutInMS,
  SQSEvent,
} from "./Lambda";

t.beforeEach(async () => {
  delete process.env.AIKIDO_LAMBDA_FLUSH_EVERY_MS;
  delete process.env.AIKIDO_LAMBDA_TIMEOUT_MS;
});

const gatewayEvent: APIGatewayProxyEvent = {
  resource: "/dev/{proxy+}",
  body: "body",
  httpMethod: "GET",
  queryStringParameters: {
    query: "value",
  },
  pathParameters: {
    parameter: "value",
  },
  headers: {
    "content-type": "application/json",
    cookie: "cookie=value",
  },
  requestContext: {
    identity: {
      sourceIp: "1.2.3.4",
    },
  },
};

const lambdaContext: Context = {
  awsRequestId: "",
  callbackWaitsForEmptyEventLoop: false,
  functionName: "",
  functionVersion: "",
  invokedFunctionArn: "",
  logGroupName: "",
  logStreamName: "",
  memoryLimitInMB: "",
  done: () => {},
  fail: () => {},
  getRemainingTimeInMillis: () => 0,
  succeed: () => {},
};

t.test("it transforms callback handler to async handler", async (t) => {
  const handler = createLambdaWrapper((event, context, callback) => {
    callback(null, {
      body: JSON.stringify(getContext()),
      statusCode: 200,
    });
  });

  const result = (await handler(
    gatewayEvent,
    lambdaContext,
    () => {}
  )) as unknown as { body: string };

  t.same(JSON.parse(result.body), {
    method: "GET",
    remoteAddress: "1.2.3.4",
    headers: {
      "content-type": "application/json",
      cookie: "cookie=value",
    },
    query: {
      query: "value",
    },
    cookies: {
      cookie: "value",
    },
    routeParams: {
      parameter: "value",
    },
    source: "lambda/gateway",
    route: "/dev/{proxy+}",
  });
});

t.test("callback handler throws error", async () => {
  const handler = createLambdaWrapper((event, context, callback) => {
    callback(new Error("error"));
  });

  try {
    await handler(gatewayEvent, lambdaContext, () => {});
  } catch (error) {
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.same(error.message, "error");
    }
  }
});

t.test("callback handler has internal error", async () => {
  const handler = createLambdaWrapper((event, context, callback) => {
    throw new Error("error");
  });

  try {
    await handler(gatewayEvent, lambdaContext, () => {});
  } catch (error) {
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.same(error.message, "error");
    }
  }
});

t.test("json header is missing for gateway event", async (t) => {
  const handler = createLambdaWrapper((event, context, callback) => {
    callback(null, {
      body: JSON.stringify(getContext()),
      statusCode: 200,
    });
  });

  const result = (await handler(
    {
      ...gatewayEvent,
      headers: {},
    },
    lambdaContext,
    () => {}
  )) as unknown as { body: string };

  t.same(JSON.parse(result.body), {
    method: "GET",
    remoteAddress: "1.2.3.4",
    headers: {},
    query: { query: "value" },
    cookies: {},
    routeParams: {
      parameter: "value",
    },
    source: "lambda/gateway",
    route: "/dev/{proxy+}",
  });
});

t.test("it handles SQS event", async (t) => {
  const handler = createLambdaWrapper(async (event, context) => {
    return getContext();
  });

  const event: SQSEvent = {
    Records: [
      {
        body: JSON.stringify({
          key: "value",
        }),
      },
    ],
  };

  const result = await handler(event, lambdaContext, () => {});

  t.same(result, {
    url: undefined,
    method: undefined,
    remoteAddress: undefined,
    body: {
      Records: [
        {
          body: {
            key: "value",
          },
        },
      ],
    },
    headers: {},
    query: {},
    cookies: {},
    routeParams: {},
    source: "lambda/sqs",
    route: undefined,
  });
});

t.test("it passes through unknown types of events", async () => {
  const handler = createLambdaWrapper(async (event, context) => {
    return getContext();
  });

  const result = await handler(
    {
      unknown: "event",
    },
    lambdaContext,
    () => {}
  );

  t.same(result, undefined);
});

t.test("it sends heartbeat after first and every 10 minutes", async () => {
  const clock = FakeTimers.install();

  const testing = new ReportingAPIForTesting();
  const agent = createTestAgent({
    block: false,
    token: new Token("token"),
    serverless: "lambda",
    api: testing,
  });
  agent.start([]);

  const handler = createLambdaWrapper(async (event, context) => {
    return getContext();
  });

  testing.clear();

  t.same(testing.getEvents(), []);

  for (let i = 0; i < 99; i++) {
    agent.getInspectionStatistics().onInspectedCall({
      operation: "mongodb.query",
      kind: "nosql_op",
      blocked: false,
      durationInMs: 0.1,
      attackDetected: false,
      withoutContext: false,
    });

    await handler(gatewayEvent, lambdaContext, () => {});

    if (i === 0) {
      t.match(testing.getEvents(), [
        { type: "started" },
        { type: "heartbeat" },
      ]);
    }
  }

  t.match(testing.getEvents(), [{ type: "started" }, { type: "heartbeat" }]);

  testing.clear();

  clock.tick(1);

  agent.getInspectionStatistics().onInspectedCall({
    operation: "mongodb.query",
    kind: "nosql_op",
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
    withoutContext: false,
  });

  await handler(gatewayEvent, lambdaContext, () => {});

  t.same(testing.getEvents(), []);

  clock.tick(60 * 1000 * 10);

  agent.getInspectionStatistics().onInspectedCall({
    operation: "mongodb.query",
    kind: "nosql_op",
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
    withoutContext: false,
  });

  await handler(gatewayEvent, lambdaContext, () => {});

  t.same(testing.getEvents(), [
    {
      type: "heartbeat",
      time: Date.now(),
      // @ts-expect-error AgentInfo is private
      agent: agent.getAgentInfo(),
      hostnames: [],
      routes: [],
      users: [],
      packages: [],
      ai: [],
      stats: {
        operations: {
          "mongodb.query": {
            kind: "nosql_op",
            total: 100,
            attacksDetected: {
              total: 0,
              blocked: 0,
            },
            interceptorThrewError: 0,
            withoutContext: 0,
            compressedTimings: [
              {
                averageInMS: 0.09999999999999981,
                percentiles: {
                  50: 0.1,
                  75: 0.1,
                  90: 0.1,
                  95: 0.1,
                  99: 0.1,
                },
                compressedAt: 60 * 1000 * 10 + 1,
              },
            ],
          },
        },
        startedAt: 0,
        endedAt: 60 * 1000 * 10 + 1,
        requests: {
          total: 100,
          aborted: 0,
          rateLimited: 0,
          attacksDetected: {
            total: 0,
            blocked: 0,
          },
          attackWaves: {
            total: 0,
            blocked: 0,
          },
        },
        userAgents: {
          breakdown: {},
        },
        ipAddresses: {
          breakdown: {},
        },
        sqlTokenizationFailures: 0,
      },
      middlewareInstalled: false,
    },
  ]);

  clock.uninstall();
});

t.test(
  "it keeps working if token is not set (no reset happening)",
  async () => {
    const clock = FakeTimers.install();

    const testing = new ReportingAPIForTesting();
    const agent = createTestAgent({
      block: false,
      serverless: "lambda",
      api: testing,
    });
    agent.start([]);

    const handler = createLambdaWrapper(async (event, context) => {
      return getContext();
    });

    testing.clear();

    for (let i = 0; i < 100; i++) {
      agent.getInspectionStatistics().onInspectedCall({
        operation: "mongodb.query",
        kind: "nosql_op",
        blocked: false,
        durationInMs: 0.1,
        attackDetected: false,
        withoutContext: false,
      });
      await handler(gatewayEvent, lambdaContext, () => {});
    }

    t.same(testing.getEvents(), []);

    clock.uninstall();
  }
);

t.test("if handler throws it still sends heartbeat", async () => {
  const clock = FakeTimers.install();

  const testing = new ReportingAPIForTesting();
  const agent = createTestAgent({
    block: false,
    token: new Token("token"),
    serverless: "lambda",
    api: testing,
  });
  agent.start([]);

  testing.clear();

  const handler = createLambdaWrapper(async (event, context) => {
    throw new Error("error");
  });

  const error = await t.rejects(
    async () => await handler(gatewayEvent, lambdaContext, () => {})
  );

  if (error instanceof Error) {
    t.same(error.message, "error");
  }

  t.match(testing.getEvents(), [{ type: "started" }, { type: "heartbeat" }]);

  clock.uninstall();
});

t.test("undefined values", async () => {
  const handler = createLambdaWrapper(async (event, context) => {
    return getContext();
  });

  const result = await handler(
    {
      ...gatewayEvent,
      headers: undefined,
      requestContext: undefined,
      queryStringParameters: undefined,
      cookies: undefined,
      pathParameters: undefined,
      resource: undefined,
    },
    lambdaContext,
    () => {}
  );

  t.same(result, {
    url: undefined,
    route: undefined,
    method: "GET",
    remoteAddress: undefined,
    body: undefined,
    headers: undefined,
    query: {},
    cookies: {},
    routeParams: {},
    source: "lambda/gateway",
  });
});

t.test("no cookie header", async () => {
  const handler = createLambdaWrapper(async (event, context) => {
    return getContext();
  });

  const result = await handler(
    {
      ...gatewayEvent,
      headers: {},
    },
    lambdaContext,
    () => {}
  );

  t.match(result, {
    cookies: {},
  });
});

t.test("it counts attacks", async () => {
  const agent = createTestAgent({
    block: false,
    token: new Token("token"),
    serverless: "lambda",
  });
  agent.start([]);

  const handler = createLambdaWrapper(async (event, context) => {
    agent.onDetectedAttack({
      module: "mongodb",
      kind: "nosql_injection",
      blocked: false,
      source: "body",
      request: {
        method: "POST",
        cookies: {},
        query: {},
        headers: {
          "user-agent": "agent",
        },
        body: {},
        url: "http://localhost:4000",
        remoteAddress: "::1",
        source: "express",
        route: "/posts/:id",
        routeParams: {},
      },
      operation: "operation",
      payload: "payload",
      stack: "stack",
      paths: [".nested"],
      metadata: {
        db: "app",
      },
    });
  });

  // This one will flush the stats
  await handler(gatewayEvent, lambdaContext, () => {});

  // This one will not flush the stats
  await handler(gatewayEvent, lambdaContext, () => {});

  t.match(agent.getInspectionStatistics().getStats(), {
    requests: {
      total: 1,
      attacksDetected: {
        total: 1,
        blocked: 0,
      },
    },
  });
});

t.test("it waits for attack events to be sent before returning", async (t) => {
  const testing = new ReportingAPIForTesting();

  wrap(testing, "report", function report(original) {
    return async function report(...args: unknown[]) {
      await setTimeout(100);

      // @ts-expect-error Type is unknown
      return original.apply(this, args);
    };
  });

  const agent = createTestAgent({
    block: false,
    token: new Token("token"),
    serverless: "lambda",
    api: testing,
  });
  agent.start([]);

  const handler = createLambdaWrapper(async (event, context) => {
    agent.onDetectedAttack({
      module: "fs",
      operation: "readFile",
      kind: "path_traversal",
      blocked: false,
      source: "body",
      request: getContext(),
      stack: "stack",
      paths: ["file"],
      metadata: {},
      payload: "../etc/passwd",
    });

    agent.onDetectedAttackWave({
      request: getContext()!,
    });

    return { statusCode: 200 };
  });

  await handler(gatewayEvent, lambdaContext, () => {});

  const events = testing.getEvents();
  const attackEvents = events.filter(
    (e) => e.type === "detected_attack" || e.type === "detected_attack_wave"
  );

  t.equal(attackEvents.length, 2, "both attack events should have been sent");
});

t.test("getFlushEveryMS", async (t) => {
  t.equal(
    getFlushEveryMS(),
    10 * 60 * 1000,
    "should return 10 minutes as default"
  );

  process.env.AIKIDO_LAMBDA_FLUSH_EVERY_MS = "120000";
  t.equal(getFlushEveryMS(), 120000, "should return 2 minutes");

  process.env.AIKIDO_LAMBDA_FLUSH_EVERY_MS = "invalid";
  t.equal(
    getFlushEveryMS(),
    10 * 60 * 1000,
    "should return 10 minutes as default for non-numeric"
  );

  process.env.AIKIDO_LAMBDA_FLUSH_EVERY_MS = "30000";
  t.equal(
    getFlushEveryMS(),
    10 * 60 * 1000,
    "should return 10 minutes as default for value below minimum"
  );

  process.env.AIKIDO_LAMBDA_FLUSH_EVERY_MS = "60000";
  t.equal(
    getFlushEveryMS(),
    60000,
    "should return 1 minute at minimum threshold"
  );
});

t.test("getTimeoutInMS", async (t) => {
  t.equal(getTimeoutInMS(), 1000, "should return 1 second as default");

  process.env.AIKIDO_LAMBDA_TIMEOUT_MS = "5000";
  t.equal(getTimeoutInMS(), 5000, "should return 5 seconds");

  process.env.AIKIDO_LAMBDA_TIMEOUT_MS = "invalid";
  t.equal(
    getTimeoutInMS(),
    1000,
    "should return 1 second as default for non-numeric"
  );

  process.env.AIKIDO_LAMBDA_TIMEOUT_MS = "500";
  t.equal(
    getTimeoutInMS(),
    1000,
    "should return 1 second as default for value below minimum"
  );

  process.env.AIKIDO_LAMBDA_TIMEOUT_MS = "1000";
  t.equal(
    getTimeoutInMS(),
    1000,
    "should return 1 second at minimum threshold"
  );
});
