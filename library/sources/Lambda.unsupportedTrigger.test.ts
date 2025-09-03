// Separate test file for shouldBlockRequest warning in lambda context
// Because the boolean flags for warnings can't be reset
import type { Context } from "aws-lambda";
import * as t from "tap";
import { createLambdaWrapper } from "./Lambda";
import { wrap } from "../helpers/wrap";

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
  "logs warning when lambda called with unsupported trigger",
  async (t) => {
    const handler = createLambdaWrapper(async (event, context) => {
      return { success: true };
    });

    const unsupportedEvent = {
      unknown: "trigger",
      data: "test",
    };

    const result = await handler(unsupportedEvent, lambdaContext, () => {});
    t.same(result, { success: true });
    t.same(logs, [
      "Zen detected a lambda function call with an unsupported trigger. Only API Gateway and SQS triggers are currently supported.",
    ]);

    // Call again to verify warning only logs once
    logs = [];
    await handler(unsupportedEvent, lambdaContext, () => {});
    t.same(logs, []);
  }
);
