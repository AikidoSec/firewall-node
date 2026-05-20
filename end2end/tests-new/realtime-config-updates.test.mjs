import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, match, fail } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-pg-ts-esm"
);

const testServerUrl = "http://localhost:5874";

function spawnApp(token, port) {
  return spawn(
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
        AIKIDO_DEBUG_SSE: "true",
        AIKIDO_BLOCK: "true",
      },
    }
  );
}

test("it picks up blocked IP via SSE config update", async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;
  const port = await getRandomPort();

  const server = spawnApp(token, port);

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

    // Wait for the server to start and SSE to connect
    await timeout(3000);

    // Verify request from 5.6.7.8 is allowed before blocking
    const before = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { "x-forwarded-for": "5.6.7.8" },
      signal: AbortSignal.timeout(5000),
    });
    equal(before.status, 200);

    // Block IP 5.6.7.8 via the test server API
    await fetch(`${testServerUrl}/api/runtime/firewall/lists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        blockedIPAddresses: ["5.6.7.8"],
      }),
    });

    // Wait for SSE config-updated event to propagate
    await timeout(2000);

    // Verify request from 5.6.7.8 is now blocked
    const after = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { "x-forwarded-for": "5.6.7.8" },
      signal: AbortSignal.timeout(5000),
    });
    equal(after.status, 403);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it reconnects SSE after server disconnects", async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;
  const port = await getRandomPort();

  const server = spawnApp(token, port);

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

    // Wait for the server to start and SSE to connect
    await timeout(3000);
    match(stdout, /SSE connected successfully/);

    // Disconnect SSE from the server side
    await fetch(`${testServerUrl}/api/runtime/stream/disconnect`, {
      method: "POST",
      headers: { Authorization: token },
    });

    // Wait for reconnect (initial reconnect delay is 1s)
    await timeout(3000);
    match(stdout, /SSE connection closed by server, reconnecting/);

    // Verify SSE reconnected
    const connectedCount = stdout.split("SSE connected successfully").length - 1;
    equal(connectedCount >= 2, true);

    // Block IP 9.8.7.6 after reconnect to verify the new connection works
    await fetch(`${testServerUrl}/api/runtime/firewall/lists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        blockedIPAddresses: ["9.8.7.6"],
      }),
    });

    // Wait for SSE config-updated event to propagate
    await timeout(2000);

    // Verify the blocked IP is picked up via the reconnected SSE
    const blocked = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { "x-forwarded-for": "9.8.7.6" },
      signal: AbortSignal.timeout(5000),
    });
    equal(blocked.status, 403);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
