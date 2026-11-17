import * as t from "tap";
import { getServerlessFromEnv } from "./getServerlessFromEnv";

const envKeys = [
  "AWS_LAMBDA_FUNCTION_NAME",
  "AWS_EXECUTION_ENV",
  "FUNCTION_TARGET",
  "FUNCTION_SIGNATURE_TYPE",
  "K_SERVICE",
];

t.beforeEach(() => {
  for (const key of envKeys) {
    delete process.env[key];
  }
});

t.test("it returns undefined outside of Lambda", async (t) => {
  t.equal(getServerlessFromEnv(), undefined);
});

t.test("it detects Lambda using the function name", async (t) => {
  process.env.AWS_LAMBDA_FUNCTION_NAME = "my-function";
  t.equal(getServerlessFromEnv(), "lambda");
});

t.test("it detects Lambda using the execution env", async (t) => {
  process.env.AWS_EXECUTION_ENV = "AWS_Lambda_nodejs22.x";
  t.equal(getServerlessFromEnv(), "lambda");
});

t.test("it ignores other execution envs", async (t) => {
  process.env.AWS_EXECUTION_ENV = "AWS_ECS_FARGATE";
  t.equal(getServerlessFromEnv(), undefined);
});

t.test("it detects Google Cloud HTTP functions", async (t) => {
  process.env.FUNCTION_TARGET = "myFunction";
  process.env.FUNCTION_SIGNATURE_TYPE = "http";
  t.equal(getServerlessFromEnv(), "gcp");
});

t.test("it ignores Google Cloud event functions", async (t) => {
  process.env.FUNCTION_TARGET = "myFunction";
  process.env.FUNCTION_SIGNATURE_TYPE = "event";
  t.equal(getServerlessFromEnv(), undefined);
});

t.test("it ignores function target without signature type", async (t) => {
  process.env.FUNCTION_TARGET = "myFunction";
  t.equal(getServerlessFromEnv(), undefined);
});

t.test("it ignores regular Cloud Run services", async (t) => {
  process.env.K_SERVICE = "my-service";
  t.equal(getServerlessFromEnv(), undefined);
});
