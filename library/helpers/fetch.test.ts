import * as t from "tap";
import { createServer, Server } from "http";
import { fetch } from "./fetch";

let server: Server;

// Start an HTTP server before running tests
t.beforeEach(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ method: req.method, body }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve)); // Start the server asynchronously
});

// Stop the server after running tests
t.afterEach(async () => {
  await new Promise((resolve) => server.close(resolve)); // Stop the server asynchronously
});

t.test("should make a GET request", async (t) => {
  const url = new URL(`http://localhost:${(server.address() as any).port}`);
  const response = await fetch({ url });

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
