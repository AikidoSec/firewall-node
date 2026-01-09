import * as t from "tap";
import { Token } from "../agent/api/Token";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { startTestAgent } from "../helpers/startTestAgent";
import { FileSystem } from "../sinks/FileSystem";
import { HTTPServer } from "./HTTPServer";
import { RawBody } from "./RawBody";
import { fetch } from "../helpers/fetch";

// Async needed because `require(...)` is translated to `await import(..)` when running tests in ESM mode
export async function createRawBodyTests(rawBodyPackageName: string) {
  startTestAgent({
    token: new Token("123"),
    api: new ReportingAPIForTesting(),
    wrappers: [new HTTPServer(), new FileSystem(), new RawBody()],
    rewrite: {
      "raw-body": rawBodyPackageName,
    },
  });

  const http = require("http") as typeof import("http");
  const { readFile } = require("fs/promises") as typeof import("fs/promises");
  const rawBodyModule = require(rawBodyPackageName);
  // Handle both CommonJS (returns function) and ESM (returns { default: fn })
  const rawBody = (rawBodyModule.default ||
    rawBodyModule) as typeof import("raw-body");

  t.test(
    "it blocks path traversal from body parsed with raw-body",
    async (t) => {
      const server = http.createServer(async (req, res) => {
        try {
          const buffer = await rawBody(req, { limit: "1mb" });
          const body = JSON.parse(buffer.toString("utf-8"));

          if (!body.file) {
            res.statusCode = 400;
            res.end("Missing file");
            return;
          }

          const data = await readFile(body.file, "utf-8");
          res.end(data);
        } catch (err) {
          const error = err as Error;
          res.statusCode = 500;
          res.end(error.message);
        }
      });

      server.listen(0);
      const port = (server.address() as { port: number }).port;

      try {
        const response = await fetch({
          url: new URL(`http://localhost:${port}/`),
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: "/etc/passwd",
          }),
        });

        t.same(response.statusCode, 500);
        t.match(
          response.body,
          /Zen has blocked a path traversal attack: fs.readFile\(\.\.\.\) originating from rawBody/
        );
      } finally {
        server.close();
      }
    }
  );

  t.test("it works with callback style", async (t) => {
    const server = http.createServer((req, res) => {
      rawBody(req, { limit: "1mb" }, (err: Error | null, buffer: Buffer) => {
        if (err) {
          res.statusCode = 500;
          res.end(err.message);
          return;
        }

        res.setHeader("Content-Type", "application/json");
        res.end(buffer.toString("utf-8"));
      });
    });

    server.listen(0);
    const port = (server.address() as { port: number }).port;

    try {
      const response = await fetch({
        url: new URL(`http://localhost:${port}/`),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: "value" }),
      });

      t.same(response.statusCode, 200);
      t.same(JSON.parse(response.body), { test: "value" });
    } finally {
      server.close();
    }
  });

  t.test("it works with encoding option", async (t) => {
    const server = http.createServer(async (req, res) => {
      try {
        const str = await rawBody(req, { encoding: "utf-8" });
        res.end(str);
      } catch (err) {
        const error = err as Error;
        res.statusCode = 500;
        res.end(error.message);
      }
    });

    server.listen(0);
    const port = (server.address() as { port: number }).port;

    try {
      const response = await fetch({
        url: new URL(`http://localhost:${port}/`),
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "plain text content",
      });

      t.same(response.statusCode, 200);
      t.same(response.body, "plain text content");
    } finally {
      server.close();
    }
  });

  t.test("it works without options", async (t) => {
    const server = http.createServer(async (req, res) => {
      try {
        const buffer = await rawBody(req);
        res.end(buffer.toString("utf-8"));
      } catch (err) {
        const error = err as Error;
        res.statusCode = 500;
        res.end(error.message);
      }
    });

    server.listen(0);
    const port = (server.address() as { port: number }).port;

    try {
      const response = await fetch({
        url: new URL(`http://localhost:${port}/`),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "value" }),
      });

      t.same(response.statusCode, 200);
      t.same(JSON.parse(response.body), { key: "value" });
    } finally {
      server.close();
    }
  });
}
