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
  routeParams: {},
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
    const put = await s3
      .putObject({
        Bucket: "bucket",
        Key: "test.txt",
      })
      .promise();

    t.same(put.$response.httpResponse.statusCode, 200);
  }

  function safeSignedURL() {
    const url = s3.getSignedUrl("getObject", {
      Bucket: "bucket",
      Key: "test.txt",
    });

    t.same(url.startsWith("http://localhost:9090/bucket/test.txt"), true);
  }

  async function unsafeOperation() {
    await s3
      .putObject({
        Bucket: "bucket",
        Key: "test/../test.txt",
      })
      .promise();
  }

  function unsafeSignedURL() {
    s3.getSignedUrl("getObject", {
      Bucket: "bucket",
      Key: "test/../test.txt",
    });
  }

  // No context
  await safeOperation();
  await unsafeOperation();
  safeSignedURL();
  unsafeSignedURL();

  await runWithContext(unsafeContext, async () => {
    await safeOperation();
    const error = await t.rejects(() => unsafeOperation());
    if (error instanceof Error) {
      t.same(
        error.message,
        "Aikido runtime has blocked a Path traversal: S3.putObject(...) originating from body.file.matches"
      );
    }

    safeSignedURL();
    const signedURLError = t.throws(() => unsafeSignedURL());
    if (signedURLError instanceof Error) {
      t.same(
        signedURLError.message,
        "Aikido runtime has blocked a Path traversal: S3.getSignedUrl(...) originating from body.file.matches"
      );
    }
  });
});
