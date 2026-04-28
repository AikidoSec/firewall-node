import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, match, fail } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-pg-esm"
);
const testServerUrl = "http://localhost:5874";

const blockedUrl = "https://ssrf-redirects.testssandbox.com/";
const allowedUrl = "https://aikido.dev/";
const unknownUrl = "https://google.com/";

test("blockNewOutgoingRequests is false", async () => {
  const port = await getRandomPort();

  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;

  const config = await fetch(`${testServerUrl}/api/runtime/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      allowedIPAddresses: ["1.2.3.4"],
      blockNewOutgoingRequests: false,
      domains: [
        { hostname: "ssrf-redirects.testssandbox.com", mode: "block" },
        { hostname: "aikido.dev", mode: "allow" },
        // Otherwise we cannot communicate with the mock server
        { hostname: "localhost", mode: "allow" },
      ],
    }),
  });
  equal(config.status, 200);

  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
      },
    }
  );

  server.on("error", (err) => {
    fail(err);
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  try {
    await timeout(2000);

    // Blocks request to blocked domain
    const blocked = await fetch(
      `http://127.0.0.1:${port}/fetch?url=${encodeURIComponent(blockedUrl)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    equal(blocked.status, 500);
    match(stderr, /Zen has blocked an outbound connection/);

    // Allows request to allowed domain
    const allowed = await fetch(
      `http://127.0.0.1:${port}/fetch?url=${encodeURIComponent(allowedUrl)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    equal(allowed.status, 200);
    equal((await allowed.json()).success, true);

    // Allows request to unknown domain
    const unknown = await fetch(
      `http://127.0.0.1:${port}/fetch?url=${encodeURIComponent(unknownUrl)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    equal(unknown.status, 200);
    equal((await unknown.json()).success, true);

    // Allows blocked domain from bypass IP
    stderr = "";
    const bypass = await fetch(
      `http://127.0.0.1:${port}/fetch?url=${encodeURIComponent(blockedUrl)}`,
      {
        headers: { "X-Forwarded-For": "1.2.3.4" },
        signal: AbortSignal.timeout(5000),
      }
    );
    equal(bypass.status, 200);
    equal((await bypass.json()).success, true);
  } finally {
    server.kill();
  }
});

test("blockNewOutgoingRequests is true", async () => {
  const port = await getRandomPort();

  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;

  const config = await fetch(`${testServerUrl}/api/runtime/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      allowedIPAddresses: ["1.2.3.4"],
      blockNewOutgoingRequests: true,
      domains: [
        { hostname: "ssrf-redirects.testssandbox.com", mode: "block" },
        { hostname: "aikido.dev", mode: "allow" },
      ],
    }),
  });
  equal(config.status, 200);

  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
      },
    }
  );

  server.on("error", (err) => {
    fail(err);
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  try {
    await timeout(2000);

    // Blocks request to blocked domain
    const blocked = await fetch(
      `http://127.0.0.1:${port}/fetch?url=${encodeURIComponent(blockedUrl)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    equal(blocked.status, 500);
    match(stderr, /Zen has blocked an outbound connection/);

    // Allows request to allowed domain
    const allowed = await fetch(
      `http://127.0.0.1:${port}/fetch?url=${encodeURIComponent(allowedUrl)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    equal(allowed.status, 200);
    equal((await allowed.json()).success, true);

    // Blocks request to unknown domain
    stderr = "";
    const unknown = await fetch(
      `http://127.0.0.1:${port}/fetch?url=${encodeURIComponent(unknownUrl)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    equal(unknown.status, 500);
    match(stderr, /Zen has blocked an outbound connection/);

    // Allows unknown domain from bypass IP
    stderr = "";
    const bypass = await fetch(
      `http://127.0.0.1:${port}/fetch?url=${encodeURIComponent(unknownUrl)}`,
      {
        headers: { "X-Forwarded-For": "1.2.3.4" },
        signal: AbortSignal.timeout(5000),
      }
    );
    equal(bypass.status, 200);
    equal((await bypass.json()).success, true);
  } finally {
    server.kill();
  }
});
