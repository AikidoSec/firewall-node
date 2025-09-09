import * as t from "tap";
import { runWithContext } from "../agent/Context";
import { fetch } from "../helpers/fetch";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { createTestAgent } from "../helpers/createTestAgent";
import { Token } from "../agent/api/Token";
import { HTTPServer } from "./HTTPServer";

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

const http = require("http") as typeof import("http");

t.test(
  "nested runWithContext updates source in attack wave reports",
  async (t) => {
    const server = http.createServer((req, res) => {
      runWithContext(
        {
          remoteAddress:
            getMajorNodeVersion() === 16 ? "::ffff:127.0.0.1" : "::1",
          method: "POST",
          url: "http://localhost:3330/.env",
          query: {},
          headers: {},
          body: undefined,
          cookies: {},
          routeParams: {},
          source: "express",
          route: "/.env",
        },
        () => {
          res.statusCode = 404;
          res.end("OK");
        }
      );
    });

    api.clear();

    await new Promise<void>((resolve) => {
      server.listen(3330, async () => {
        for (let i = 0; i < 20; i++) {
          await fetch({
            url: new URL("http://localhost:3330/.env"),
            method: "GET",
            headers: {},
            timeoutInMS: 500,
          });
        }

        t.match(api.getEvents(), [
          {
            type: "detected_attack_wave",
            attack: {
              metadata: {},
              user: undefined,
            },
            request: {
              source: "express",
            },
            agent: {
              library: "firewall-node",
            },
          },
        ]);

        server.close();
        resolve();
      });
    });
  }
);
