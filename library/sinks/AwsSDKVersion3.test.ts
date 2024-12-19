import { CreateBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { fromEnv } from "@aws-sdk/credential-providers";
import * as t from "tap";
import { createTestAgent } from "../helpers/createTestAgent";
import { HTTPRequest } from "./HTTPRequest";

t.test("it works", async (t) => {
  const agent = createTestAgent();

  agent.start([new HTTPRequest()]);

  const { S3Client } =
    require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");

  process.env.AWS_ACCESS_KEY_ID = "test";
  process.env.AWS_SECRET_ACCESS_KEY = "test";

  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://localhost:9090",
    credentials: fromEnv(),
    forcePathStyle: true,
  });

  const name = "bucket";

  try {
    await s3.send(new CreateBucketCommand({ Bucket: name }));
  } catch (err: any) {
    if (err.Code !== "BucketAlreadyOwnedByYou") {
      throw err;
    }
  }

  const buckets = await s3.send(new ListBucketsCommand({}));
  t.same(
    buckets.Buckets?.map((bucket) => bucket.Name),
    [name]
  );
});
