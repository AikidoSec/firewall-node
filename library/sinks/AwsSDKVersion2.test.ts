import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
import { AwsSDKVersion2 } from "./AwsSDKVersion2";
import { createTestAgent } from "../helpers/createTestAgent";

if (!isEsmUnitTest()) {
  // Suppress upgrade to SDK v3 notice
  require("aws-sdk/lib/maintenance_mode_message").suppress = true;
}

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
  route: "/posts/:id",
};

t.test("it works", async (t) => {
  const agent = createTestAgent();

  agent.start([new AwsSDKVersion2()]);

  let AWS = require("aws-sdk") as typeof import("aws-sdk");

  if (isEsmUnitTest()) {
    // @ts-expect-error in ESM the default export is the AWS object
    AWS = AWS.default;
  }

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
        "Zen has blocked a path traversal attack: S3.putObject(...) originating from body.file.matches"
      );
    }

    safeSignedURL();
    const signedURLError = t.throws(() => unsafeSignedURL());
    if (signedURLError instanceof Error) {
      t.same(
        signedURLError.message,
        "Zen has blocked a path traversal attack: S3.getSignedUrl(...) originating from body.file.matches"
      );
    }
  });
});
