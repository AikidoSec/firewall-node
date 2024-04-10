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
  console.log(logger.getMessages());

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

  await s3
    .putObject({
      Bucket: "bucket",
      Key: "test",
    })
    .promise();

  await runWithContext(unsafeContext, async () => {
    await s3
      .putObject({
        Bucket: "bucket",
        Key: "test",
      })
      .promise();
  });
});

/*
t.test("it works", async () => {
  const logger = new LoggerForTesting();
  const agent = new Agent(
    true,
    logger,
    new APIForTesting(),
    undefined,
    undefined
  );
  agent.start([new AwsSDK()]);
  console.log(logger.getMessages());

  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://localhost:9090",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
    forcePathStyle: true,
  });

  console.log(s3);

  await s3.send(
    new PutObjectCommand({
      Bucket: "bucket",
      Key: "test",
      Body: "test",
    })
  );
});
*/
