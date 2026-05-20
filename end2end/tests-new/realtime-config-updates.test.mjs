import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-pg-ts-esm"
);

const testServerUrl = "http://localhost:5874";
const port = await getRandomPort();

test("it picks up blocked IP via SSE config update", async () => {
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
