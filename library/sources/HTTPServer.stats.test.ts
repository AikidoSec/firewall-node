import { Token } from "../agent/api/Token";
import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { fetch } from "../helpers/fetch";
import { wrap } from "../helpers/wrap";
import { HTTPServer } from "./HTTPServer";
import { createTestAgent } from "../helpers/createTestAgent";
import type { Response } from "../agent/api/fetchBlockedLists";
import * as fetchBlockedLists from "../agent/api/fetchBlockedLists";

// Before require("http")
const api = new ReportingAPIForTesting({
  success: true,
  configUpdatedAt: 0,
  allowedIPAddresses: [],
  blockedUserIds: [],
  endpoints: [],
  heartbeatIntervalInMS: 10 * 60 * 1000,
});

const agent = createTestAgent({
  token: new Token("123"),
  api,
});

agent.start([new HTTPServer()]);

wrap(fetchBlockedLists, "fetchBlockedLists", function fetchBlockedLists() {
  return async function fetchBlockedLists(): Promise<Response> {
    return {
      allowedIPAddresses: [],
      blockedIPAddresses: [
        {
          key: "known_threat_actors/public_scanners",
          monitor: true,
          ips: ["1.2.3.4/32"],
          source: "test",
          description: "Test IP list",
        },
      ],
      blockedUserAgents: [
        {
          key: "ai_data_scrapers",
          monitor: true,
          pattern: "GPTBot|Google-Extended",
        },
      ],
    } satisfies Response;
  };
});

t.setTimeout(30 * 1000);

const http = require("http") as typeof import("http");

t.test("it tracks monitored user agents", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3327, () => {
      Promise.all([
        fetch({
          url: new URL("http://localhost:3327/test"),
          method: "GET",
          headers: {
            "user-agent": "GPTBot",
          },
          timeoutInMS: 500,
        }),
        fetch({
          url: new URL("http://localhost:3327/test"),
          method: "GET",
          headers: {
            "user-agent": "Google-Extended",
          },
          timeoutInMS: 500,
        }),
        fetch({
          url: new URL("http://localhost:3327/test"),
          method: "GET",
          headers: {
            "user-agent": "Regular Browser",
          },
          timeoutInMS: 500,
        }),
      ]).then(([response1, response2, response3]) => {
        t.equal(response1.statusCode, 200);
        t.equal(response2.statusCode, 200);
        t.equal(response3.statusCode, 200);
        const stats = agent.getInspectionStatistics().getStats();
        t.same(stats.requests.userAgents, {
          total: 2,
          blocked: 0,
          breakdown: {
            // eslint-disable-next-line camelcase
            ai_data_scrapers: { total: 2, blocked: 0 },
          },
        });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it tracks monitored IP addresses", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  await new Promise<void>((resolve) => {
    server.listen(3328, () => {
      Promise.all([
        fetch({
          url: new URL("http://localhost:3328/test"),
          method: "GET",
          headers: {
            "x-forwarded-for": "1.2.3.4",
          },
          timeoutInMS: 500,
        }),
        fetch({
          url: new URL("http://localhost:3328/test"),
          method: "GET",
          headers: {
            "x-forwarded-for": "5.6.7.8",
          },
          timeoutInMS: 500,
        }),
      ]).then(([response1, response2]) => {
        t.equal(response1.statusCode, 200);
        t.equal(response2.statusCode, 200);
        const stats = agent.getInspectionStatistics().getStats();
        t.same(stats.requests.ipAddresses, {
          total: 1,
          blocked: 0,
          breakdown: {
            "known_threat_actors/public_scanners": { total: 1, blocked: 0 },
          },
        });
        server.close();
        resolve();
      });
    });
  });
});
