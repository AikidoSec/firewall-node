import { Token } from "../agent/api/Token";
import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { fetch } from "../helpers/fetch";
import { HTTPServer } from "./HTTPServer";
import { createTestAgent } from "../helpers/createTestAgent";
import { FetchListsAPIForTesting } from "../agent/api/FetchListsAPIForTesting";

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
  fetchListsAPI: new FetchListsAPIForTesting({
    allowedIPAddresses: [],
    blockedIPAddresses: [],
    monitoredIPAddresses: [
      {
        key: "known_threat_actors/public_scanners",
        ips: ["1.2.3.4/32"],
        source: "test",
        description: "Test IP list",
      },
    ],
    blockedUserAgents: "",
    monitoredUserAgents: "GPTBot|Google-Extended",
    userAgentDetails: [
      {
        key: "ai_data_scrapers",
        pattern: "GPTBot",
      },
      {
        key: "google_extended",
        pattern: "Google-Extended",
      },
    ],
  }),
});

agent.start([new HTTPServer()]);

t.setTimeout(30 * 1000);

const http = require("http") as typeof import("http");

t.beforeEach(() => {
  agent.getInspectionStatistics().reset();
});

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
        t.same(stats.userAgents, {
          breakdown: {
            ai_data_scrapers: 1,
            google_extended: 1,
          },
        });
        t.same(stats.ipAddresses, {
          breakdown: {},
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
        t.same(stats.userAgents, {
          breakdown: {},
        });
        t.same(stats.ipAddresses, {
          breakdown: {
            "known_threat_actors/public_scanners": 1,
          },
        });
        server.close();
        resolve();
      });
    });
  });
});

t.test("it only counts once if multiple listeners", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.end("OK");
  });

  server.on("request", (req, res) => {
    // This is a second listener
  });

  server.on("request", (req, res) => {
    // This is a third listener
  });

  await new Promise<void>((resolve) => {
    server.listen(3329, () => {
      Promise.all([
        fetch({
          url: new URL("http://localhost:3329/test"),
          method: "GET",
          headers: {
            "user-agent": "GPTBot",
            "x-forwarded-for": "1.2.3.4",
          },
          timeoutInMS: 500,
        }),
        fetch({
          url: new URL("http://localhost:3329/test"),
          method: "GET",
          headers: {
            "user-agent": "GPTBot",
            "x-forwarded-for": "1.2.3.4",
          },
          timeoutInMS: 500,
        }),
      ]).then(() => {
        const { userAgents, ipAddresses } = agent
          .getInspectionStatistics()
          .getStats();
        t.same(userAgents, {
          breakdown: {
            ai_data_scrapers: 2,
          },
        });
        t.same(ipAddresses, {
          breakdown: {
            "known_threat_actors/public_scanners": 2,
          },
        });
        server.close();
        resolve();
      });
    });
  });
});
