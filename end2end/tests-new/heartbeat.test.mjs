import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, partialDeepStrictEqual } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-pg-ts-esm"
);

const port = await getRandomPort();

const testServerUrl = "http://localhost:5874";

test("It reports own http requests in heartbeat events", async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;

  const server = spawn(
    `node`,
    [
      "--require",
      "@aikidosec/firewall/instrument",
      "--experimental-strip-types",
      "./app.ts",
      port,
    ],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
      },
    }
  );

  try {
    server.on("error", (err) => {
      fail(err);
    });

    let stdout = "";
    server.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    let stderr = "";
    server.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Wait for the server to start
    await timeout(2000);

    await fetch(`http://127.0.0.1:${port}/`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    // Wait for first heartbeat to be sent
    await timeout(31000);

    const eventsResponse = await fetch(`${testServerUrl}/api/runtime/events`, {
      method: "GET",
      headers: {
        Authorization: token,
      },
      signal: AbortSignal.timeout(5000),
    });

    const events = await eventsResponse.json();
    const heartbeatEvents = events.filter(
      (event) => event.type === "heartbeat"
    );

    equal(heartbeatEvents.length, 1);
    partialDeepStrictEqual(heartbeatEvents, [
      {
        type: "heartbeat",
        hostnames: [
          {
            hostname: "localhost",
            port: 5874,
            hits: 2,
          },
        ],
        agent: {
          dryMode: false,
          library: "firewall-node",
          preventedPrototypePollution: false,
          serverless: false,
        },
        packages: [
          {
            name: "@aikidosec/firewall",
          },
          {
            name: "hono",
          },
          {
            name: "pg",
          },
        ],
        stats: {
          operations: {
            "pg.query": {
              attacksDetected: {
                blocked: 0,
                total: 0,
              },
              kind: "sql_op",
            },
          },
          requests: {
            aborted: 0,
            attackWaves: {
              blocked: 0,
              total: 0,
            },
            attacksDetected: {
              blocked: 0,
              total: 0,
            },
            rateLimited: 0,
            total: 1,
          },
          sqlTokenizationFailures: 0,
        },
        routes: [
          {
            hits: 1,
            method: "GET",
            path: "/",
            rateLimitedCount: 0,
          },
        ],
        users: [],
      },
    ]);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
