// Separate test file because the boolean flags for warnings can't be reset
import type { Context } from "aws-lambda";
import * as t from "tap";
import { Token } from "../agent/api/Token";
import { createTestAgent } from "../helpers/createTestAgent";
import { shouldBlockRequest } from "../middleware/shouldBlockRequest";
import { createLambdaWrapper } from "./Lambda";
import { wrap } from "../helpers/wrap";
import type { APIGatewayProxyEventV1 } from "./lambda/gateway";

const gatewayEvent: APIGatewayProxyEventV1 = {
  resource: "/dev/{proxy+}",
  path: "/dev/some/path",
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

let logs: string[] = [];
wrap(console, "warn", function warn() {
  return function warn(message: string) {
    logs.push(message);
  };
});

t.beforeEach(() => {
  logs = [];
});

t.test(
  "shouldBlockRequest logs warning when called inside serverless function",
  async (t) => {
    const agent = createTestAgent({
      block: false,
      token: new Token("token"),
      serverless: "lambda",
    });
    agent.start([]);

    const handler = createLambdaWrapper(async () => {
      return shouldBlockRequest();
    });

    const result = await handler(gatewayEvent, lambdaContext, () => {});

    t.same(result, { block: false });
    t.same(logs, [
      "Zen.shouldBlockRequest() was called within a serverless function. Rate limiting and user blocking are only supported for traditional/long running apps due to the constraints of serverless environments.",
    ]);

    // Call again to verify warning only logs once
    logs = [];
    await handler(gatewayEvent, lambdaContext, () => {});
    t.same(logs, []);
  }
);
