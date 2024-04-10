import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerForTesting } from "../agent/logger/LoggerForTesting";
import { AwsSDKVersion2 } from "./AwsSDKVersion2";

const unsafeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    file: {
      matches: "../test.txt",
    },
  },
  cookies: {},
  source: "express",
};

t.test("it works", async (t) => {
  const logger = new LoggerForTesting();
  const agent = new Agent(
    true,
    logger,
    new APIForTesting(),
    undefined,
    undefined
  );

  agent.start([new AwsSDKVersion2()]);

  const AWS = require("aws-sdk");

  const s3 = new AWS.S3({
    region: "us-east-1",
    endpoint: new AWS.Endpoint("http://localhost:9090"),
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
    s3ForcePathStyle: true,
  });

  async function safeOperation() {
    await s3
      .putObject({
        Bucket: "bucket",
        Key: "test.txt",
      })
      .promise();
  }

  async function unsafeOperation() {
    await s3
      .putObject({
        Bucket: "bucket",
        Key: "test/../test.txt",
      })
      .promise();
  }

  await safeOperation();
  await unsafeOperation();

  await runWithContext(unsafeContext, async () => {
    await safeOperation();
    const error = await t.rejects(() => unsafeOperation());
    if (error instanceof Error) {
      t.same(
        error.message,
        "Aikido runtime has blocked a Path traversal: S3.putObject(...) originating from body.file.matches"
      );
    }
  });
});
