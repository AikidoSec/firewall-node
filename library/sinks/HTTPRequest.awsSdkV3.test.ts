import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { HTTPRequest } from "./HTTPRequest";

// The AWS SDK v3 (S3) uses `http.request` with its own response handling.
// Wrapping the response handler of outgoing requests broke the SDK, which is why SSRF redirect detection
// had to be disabled in the past. Now it listens to a diagnostics channel and doesn't touch the response.
const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const bucketName = "bucket";
let mockServer: Server;
let endpoint: string;
let created = false;

t.before(async () => {
  mockServer = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      if (req.method === "PUT") {
        created = true;
        res.writeHead(200);
        res.end();
        return;
      }

      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?><ListAllMyBucketsResult><Owner><ID>1</ID><DisplayName>test</DisplayName></Owner><Buckets>${
          created
            ? `<Bucket><Name>${bucketName}</Name><CreationDate>2024-01-01T00:00:00.000Z</CreationDate></Bucket>`
            : ""
        }</Buckets></ListAllMyBucketsResult>`
      );
    });
  });

  mockServer.unref();

  await new Promise<void>((resolve) =>
    mockServer.listen(0, "127.0.0.1", resolve)
  );
  endpoint = `http://127.0.0.1:${(mockServer.address() as AddressInfo).port}`;
});

t.after(() => {
  mockServer.close();
  // Added in v18.2.0
  if (typeof mockServer.closeAllConnections === "function") {
    mockServer.closeAllConnections();
  }
});

t.test("it works with the AWS SDK v3", async (t) => {
  const agent = createTestAgent();
  agent.start([new HTTPRequest()]);

  const { S3Client, CreateBucketCommand, ListBucketsCommand } =
    require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");

  const s3 = new S3Client({
    region: "us-east-1",
    endpoint,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    forcePathStyle: true,
  });

  const run = async () => {
    await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    const buckets = await s3.send(new ListBucketsCommand({}));
    return buckets.Buckets?.map((bucket) => bucket.Name);
  };

  t.same(await run(), [bucketName]);
  t.same(await runWithContext(context, run), [bucketName]);
});
