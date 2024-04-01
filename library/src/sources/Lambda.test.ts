import type { Context } from "aws-lambda";
import * as t from "tap";
import { getContext } from "../agent/Context";
import { createLambdaWrapper, SQSEvent, APIGatewayProxyEvent } from "./Lambda";

const gatewayEvent: APIGatewayProxyEvent = {
  body: "body",
  httpMethod: "GET",
  queryStringParameters: {
    query: "value",
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
    source: "lambda/gateway",
  });
});

t.test("callback handler throws error", async () => {
  const handler = createLambdaWrapper((event, context, callback) => {
    callback(new Error("error"));
  });

  try {
    await handler(gatewayEvent, lambdaContext, () => {});
  } catch (error) {
    t.same(error.message, "error");
  }
});

t.test("callback handler has internal error", async () => {
  const handler = createLambdaWrapper((event, context, callback) => {
    throw new Error("error");
  });

  try {
    await handler(gatewayEvent, lambdaContext, () => {});
  } catch (error) {
    t.same(error.message, "error");
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
    source: "lambda/gateway",
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
    body: [{ key: "value" }],
    headers: {},
    query: {},
    cookies: {},
    source: "lambda/sqs",
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
