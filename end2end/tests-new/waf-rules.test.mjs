import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-xml"
);

const testServerUrl = "http://localhost:5874";

test("it blocks requests matching WAF path rule", async () => {
  const port = await getRandomPort();

  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;

  const configResp = await fetch(`${testServerUrl}/api/runtime/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      wafRules: [
        {
          id: "block-admin",
          expression: 'http.request.uri.path contains "/admin"',
          action: "block",
        },
      ],
    }),
  });
  equal(configResp.status, 200);

  const server = spawn(`node`, ["./app.js", port], {
    cwd: pathToAppDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_ENDPOINT: testServerUrl,
      AIKIDO_REALTIME_ENDPOINT: testServerUrl,
    },
  });

  try {
    await timeout(2000);

    const blocked = await fetch(`http://127.0.0.1:${port}/admin`, {
      headers: { "X-Forwarded-For": "1.2.3.4" },
      signal: AbortSignal.timeout(5000),
    });
    equal(blocked.status, 403);
    equal(await blocked.text(), "You are blocked by Zen.");

    const allowed = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { "X-Forwarded-For": "1.2.3.4" },
      signal: AbortSignal.timeout(5000),
    });
    equal(allowed.status, 200);
  } finally {
    server.kill();
  }
});

test("it blocks requests matching user agent WAF rule", async () => {
  const port = await getRandomPort();

  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;

  const configResp = await fetch(`${testServerUrl}/api/runtime/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      wafRules: [
        {
          id: "block-scanners",
          expression: 'http.user_agent matches "(?i)(sqlmap|nikto)"',
          action: "block",
        },
      ],
    }),
  });
  equal(configResp.status, 200);

  const server = spawn(`node`, ["./app.js", port], {
    cwd: pathToAppDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_ENDPOINT: testServerUrl,
      AIKIDO_REALTIME_ENDPOINT: testServerUrl,
    },
  });

  try {
    await timeout(2000);

    const blocked = await fetch(`http://127.0.0.1:${port}/`, {
      headers: {
        "User-Agent": "sqlmap/1.0",
        "X-Forwarded-For": "1.2.3.4",
      },
      signal: AbortSignal.timeout(5000),
    });
    equal(blocked.status, 403);

    const allowed = await fetch(`http://127.0.0.1:${port}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "X-Forwarded-For": "1.2.3.4",
      },
      signal: AbortSignal.timeout(5000),
    });
    equal(allowed.status, 200);
  } finally {
    server.kill();
  }
});
