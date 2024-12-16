import * as t from "tap";
import { createServer, Server } from "http";
import { fetch } from "./fetch";
import { gzip } from "zlib";

let server: Server;

// Start an HTTP server before running tests
t.beforeEach(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.stringify({
        method: req.method,
        body: Buffer.concat(chunks).toString(),
      });
      if (req.headers["accept-encoding"] === "gzip") {
        res.setHeader("Content-Encoding", "gzip");
        gzip(body, (err, result) => {
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
    });
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
  t.same(JSON.parse(response.body), { method: "GET", body: "" });
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
  t.same(JSON.parse(response.body), { method: "GET", body: "" });
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
  });
});
