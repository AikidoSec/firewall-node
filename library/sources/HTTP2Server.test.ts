import * as t from "tap";
import { Token } from "../agent/api/Token";
import { connect } from "http2";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { HTTPServer } from "./HTTPServer";
import { IncomingHttpHeaders } from "http";

// Before require
const api = new ReportingAPIForTesting({
  success: true,
  configUpdatedAt: 0,
  allowedIPAddresses: [],
  blockedUserIds: [],
  endpoints: [
    {
      route: "/rate-limited",
      method: "GET",
      forceProtectionOff: false,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 60 * 60 * 1000,
      },
    },
  ],
  heartbeatIntervalInMS: 10 * 60 * 1000,
});
const agent = new Agent(
  true,
  new LoggerNoop(),
  api,
  new Token("abc"),
  undefined
);
agent.start([new HTTPServer()]);

t.beforeEach(() => {
  delete process.env.AIKIDO_MAX_BODY_SIZE_MB;
});

function http2Request(
  url: URL,
  method: string,
  headers: Record<string, string>
) {
  return new Promise<{ headers: IncomingHttpHeaders; body: string }>(
    (resolve, reject) => {
      const client = connect(url);
      const req = client.request({
        ":path": url.pathname,
        ":method": method,
        ...headers,
      });

      let respHeaders: IncomingHttpHeaders;
      let resData = "";

      req.on("error", (err) => {
        reject(err);
      });

      req.on("response", (headers, flags) => {
        respHeaders = headers;
      });

      req.on("data", (chunk) => {
        resData += chunk;
      });
      req.on("end", () => {
        client.close();
        resolve({ headers: respHeaders, body: resData });
      });
      req.end();
    }
  );
}

t.test("it wraps the createServer function of http2 module", async () => {
  const http2 = require("http2");
  const { readFileSync } = require("fs");
  const path = require("path");

  // Otherwise, the self-signed certificate will be rejected
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const server = http2.createServer(
    {
      secureContext: {},
    },
    (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getContext()));
    }
  );

  await new Promise<void>((resolve) => {
    server.listen(3415, () => {
      http2Request(new URL("http://localhost:3415"), "GET", {}).then(
        ({ body }) => {
          const context = JSON.parse(body);
          t.same(context, {
            url: "/",
            method: "GET",
            headers: {
              ":path": "/",
              ":method": "GET",
              ":authority": "localhost:3415",
              ":scheme": "http",
            },
            query: {},
            route: "/",
            source: "http2.createServer",
            routeParams: {},
            cookies: {},
            remoteAddress: "::ffff:127.0.0.1",
          });
          server.close();
          resolve();
        }
      );
    });
  });
});
