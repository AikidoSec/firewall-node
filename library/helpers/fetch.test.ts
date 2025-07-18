import * as t from "tap";
import { createServer, Server } from "http";
import { fetch } from "./fetch";
import { createGunzip, gzip } from "zlib";
import { getMajorNodeVersion } from "./getNodeVersion";

let server: Server;

// Start an HTTP server before running tests
t.beforeEach(async () => {
  server = createServer((req, res) => {
    let bodyStr = "";
    let stream: NodeJS.ReadableStream = req;
    if (req.headers["content-encoding"] === "gzip") {
      const gunzip = createGunzip();
      req.pipe(gunzip);
      stream = gunzip;
      stream.on("error", () => {
        res.writeHead(400);
        res.end("Invalid gzip body");
      });
    }
    stream.on("data", (chunk: Buffer) => {
      bodyStr += chunk.toString();
    });
    stream.on("end", () => {
      sendResponse(bodyStr);
    });

    function sendResponse(bodyStr: string) {
      const body = JSON.stringify({
        method: req.method,
        headers: req.headers,
        body: bodyStr,
      });
      if (req.headers["accept-encoding"] === "gzip") {
        res.setHeader("Content-Encoding", "gzip");
        gzip(body, (err: Error | null, result: Buffer) => {
          if (err) {
            res.writeHead(500);
            res.end(err.message);
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(result);
        });
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(body);
      }
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
});

// Stop the server after running tests
t.afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    })
  );
});

t.test("should make a GET request", async (t) => {
  const url = new URL(`http://localhost:${(server.address() as any).port}`);
  const response = await fetch({ url });

  t.equal(response.statusCode, 200);
  t.same(JSON.parse(response.body), {
    method: "GET",
    body: "",
    headers: {
      host: `localhost:${(server.address() as any).port}`,
      connection: getMajorNodeVersion() >= 19 ? "keep-alive" : "close",
      "accept-encoding": "gzip",
    },
  });
});

t.test("should make a GET request with gzip", async (t) => {
  const url = new URL(`http://localhost:${(server.address() as any).port}`);
  const response = await fetch({
    url,
    headers: {
      "Accept-Encoding": "gzip",
    },
  });

  t.equal(response.statusCode, 200);
  t.same(JSON.parse(response.body), {
    method: "GET",
    body: "",
    headers: {
      host: `localhost:${(server.address() as any).port}`,
      connection: getMajorNodeVersion() >= 19 ? "keep-alive" : "close",
      "accept-encoding": "gzip",
    },
  });
});

t.test("should make a POST request with body", async (t) => {
  const url = new URL(`http://localhost:${(server.address() as any).port}`);
  const response = await fetch({
    url,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "value" }),
  });

  t.equal(response.statusCode, 200);
  t.same(JSON.parse(response.body), {
    method: "POST",
    body: '{"key":"value"}',
    headers: {
      host: `localhost:${(server.address() as any).port}`,
      connection: getMajorNodeVersion() >= 19 ? "keep-alive" : "close",
      "content-type": "application/json",
      "content-length": "35",
      "accept-encoding": "gzip",
      "content-encoding": "gzip",
    },
  });
});

t.test("should make a POST request with body and gzip", async (t) => {
  const url = new URL(`http://localhost:${(server.address() as any).port}`);
  const response = await fetch({
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    },
    body: JSON.stringify({ key: "value" }),
  });

  t.equal(response.statusCode, 200);
  t.same(JSON.parse(response.body), {
    method: "POST",
    body: '{"key":"value"}',
    headers: {
      host: `localhost:${(server.address() as any).port}`,
      connection: getMajorNodeVersion() >= 19 ? "keep-alive" : "close",
      "content-type": "application/json",
      "content-length": "35",
      "accept-encoding": "gzip",
      "content-encoding": "gzip",
    },
  });
});
