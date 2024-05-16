import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { fetch } from "../helpers/fetch";
import { HTTPServer } from "./HTTPServer";

// Before require("http")
const agent = new Agent(
  true,
  new LoggerNoop(),
  new ReportingAPIForTesting(),
  undefined,
  "lambda"
);
agent.start([new HTTPServer()]);

t.test("it wraps the createServer function of http module", async () => {
  const http = require("http");
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(getContext()));
  });

  server.keepAliveTimeout = 0;

  await new Promise<void>((resolve) => {
    server.listen(3314, () => {
      fetch({
        url: new URL("http://localhost:3314"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context, {
          url: "/",
          method: "GET",
          headers: { host: "localhost:3314", connection: "close" },
          query: {},
          source: "http.createServer",
          routeParams: {},
          cookies: {},
        });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it wraps the createServer function of https module", async () => {
  const https = require("https");
  const { readFileSync } = require("fs");
  const path = require("path");

  // Otherwise, the self-signed certificate will be rejected
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const server = https.createServer(
    {
      key: readFileSync(path.resolve(__dirname, "fixtures/key.pem")),
      cert: readFileSync(path.resolve(__dirname, "fixtures/cert.pem")),
      secureContext: {},
    },
    (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getContext()));
    }
  );

  server.keepAliveTimeout = 0;

  await new Promise<void>((resolve) => {
    server.listen(3315, () => {
      fetch({
        url: new URL("https://localhost:3315"),
        method: "GET",
        headers: {},
        timeoutInMS: 500,
      }).then(({ body }) => {
        const context = JSON.parse(body);
        t.same(context, {
          url: "/",
          method: "GET",
          headers: { host: "localhost:3315", connection: "close" },
          query: {},
          source: "https.createServer",
          routeParams: {},
          cookies: {},
        });
        server.close();
        resolve();
      });
    });
  });
});
