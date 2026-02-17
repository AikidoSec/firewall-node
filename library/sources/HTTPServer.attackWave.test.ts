import { Token } from "../agent/api/Token";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
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
  endpoints: [
    {
      route: "/rate-limited",
      method: "GET",
      forceProtectionOff: false,
      allowedIPAddresses: [],
      rateLimiting: {
        enabled: true,
        maxRequests: 2,
        windowSizeInMS: 60 * 60 * 1000,
      },
    },
    {
      route: "/ip-allowed",
      method: "GET",
      forceProtectionOff: false,
      allowedIPAddresses: ["8.8.8.8"],
      // @ts-expect-error Testing
      rateLimiting: undefined,
    },
    {
      route: "/routes/*",
      method: "*",
      forceProtectionOff: false,
      allowedIPAddresses: [],
      rateLimiting: {
        enabled: true,
        maxRequests: 2,
        windowSizeInMS: 60 * 60 * 1000,
      },
    },
  ],
  heartbeatIntervalInMS: 10 * 60 * 1000,
});

const mockedFetchListAPI = new FetchListsAPIForTesting({
  allowedIPAddresses: [],
  blockedIPAddresses: [
    {
      key: "geoip/Belgium;BE",
      source: "geoip",
      ips: ["9.9.9.9"],
      description: "geo restrictions",
    },
  ],
  blockedUserAgents: "",
  monitoredUserAgents: "",
  monitoredIPAddresses: [],
  userAgentDetails: [],
});

const agent = createTestAgent({
  token: new Token("123"),
  api,
  fetchListsAPI: mockedFetchListAPI,
});
agent.start([new HTTPServer()]);

t.setTimeout(30 * 1000);

t.beforeEach(() => {
  delete process.env.AIKIDO_MAX_BODY_SIZE_MB;
  delete process.env.NODE_ENV;
  delete process.env.NEXT_DEPLOYMENT_ID;
});

const http = require("http") as typeof import("http");

t.test("it reports attack waves", async (t) => {
  const server = http.createServer((req, res) => {
    res.statusCode = 404;
    res.end("OK");
  });

  api.clear();

  await new Promise<void>((resolve) => {
    server.listen(3229, async () => {
      for (let i = 0; i < 3; i++) {
        t.equal(
          (
            await fetch({
              url: new URL("http://localhost:3229/.env"),
              method: "GET",
              headers: {},
              timeoutInMS: 500,
            })
          ).statusCode,
          404
        );

        t.equal(
          (
            await fetch({
              url: new URL("http://localhost:3229/wp-config.php"),
              method: "GET",
              headers: {},
              timeoutInMS: 500,
            })
          ).statusCode,
          404
        );

        t.equal(
          (
            await fetch({
              url: new URL("http://localhost:3229/../test"),
              method: "GET",
              headers: {},
              timeoutInMS: 500,
            })
          ).statusCode,
          404
        );

        t.equal(
          (
            await fetch({
              url: new URL("http://localhost:3229/etc/passwd"),
              method: "GET",
              headers: {},
              timeoutInMS: 500,
            })
          ).statusCode,
          404
        );
        t.equal(
          (
            await fetch({
              url: new URL("http://localhost:3229/.git/config"),
              method: "GET",
              headers: {},
              timeoutInMS: 500,
            })
          ).statusCode,
          404
        );

        t.equal(
          (
            await fetch({
              url: new URL(
                "http://localhost:3229/%systemroot%/system32/cmd.exe"
              ),
              method: "GET",
              headers: {},
              timeoutInMS: 500,
            })
          ).statusCode,
          404
        );
      }

      t.match(api.getEvents(), [
        {
          type: "detected_attack_wave",
          attack: {
            metadata: {},
            user: undefined,
          },
          request: {
            ipAddress:
              getMajorNodeVersion() === 16 ? "::ffff:127.0.0.1" : "::1",
            source: "http.createServer",
          },
          agent: {
            library: "firewall-node",
          },
        },
      ]);

      await agent.flushStats(1000);

      t.match(api.getEvents(), [
        {
          type: "detected_attack_wave",
          attack: {
            metadata: {
              samples: JSON.stringify(
                [
                  {
                    method: "GET",
                    url: "/.env",
                  },
                  {
                    method: "GET",
                    url: "/wp-config.php",
                  },
                  {
                    method: "GET",
                    url: "/etc/passwd",
                  },
                  {
                    method: "GET",
                    url: "/.git/config",
                  },
                  {
                    method: "GET",
                    url: "/%systemroot%/system32/cmd.exe",
                  },
                ].map((sample) => {
                  return {
                    ...sample,
                    url: `http://localhost:3229${sample.url}`,
                  };
                })
              ),
            },
            user: undefined,
          },
          request: {
            ipAddress:
              getMajorNodeVersion() === 16 ? "::ffff:127.0.0.1" : "::1",
            source: "http.createServer",
          },
          agent: {
            library: "firewall-node",
          },
        },
        {
          type: "heartbeat",
          stats: {
            requests: {
              attackWaves: {
                total: 1,
                blocked: 0,
              },
            },
          },
        },
      ]);

      server.close();
      resolve();
    });
  });
});
