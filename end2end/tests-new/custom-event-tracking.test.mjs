import { spawn } from "node:child_process";
import { deepStrictEqual, equal, fail } from "node:assert";
import { resolve } from "node:path";
import { test } from "node:test";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/express5-esm"
);
const testServerUrl = "http://localhost:5874";

async function waitForApp(port) {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.status === 200) {
        return;
      }
    } catch {}

    await timeout(50);
  }

  throw new Error("Timed out waiting for the sample app");
}

async function getCustomEvents(token) {
  const response = await fetch(`${testServerUrl}/api/runtime/events`, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(5000),
  });
  const events = await response.json();
  return events.filter((event) => event.type === "custom");
}

async function waitForCustomEventsToSettle(token) {
  const deadline = Date.now() + 5000;
  let previousCount = -1;
  let unchangedPolls = 0;
  let customEvents = [];

  while (Date.now() < deadline) {
    customEvents = await getCustomEvents(token);
    unchangedPolls =
      customEvents.length >= 50 && customEvents.length === previousCount
        ? unchangedPolls + 1
        : 0;

    if (unchangedPolls === 5) {
      return customEvents;
    }

    previousCount = customEvents.length;
    await timeout(100);
  }

  throw new Error("Timed out waiting for custom events");
}

test("it limits custom events to 25 per request", async () => {
  const appResponse = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const { token } = await appResponse.json();
  const port = await getRandomPort();
  const server = spawn(
    "node",
    ["--import", "@aikidosec/firewall/instrument", "./app.js", port],
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

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  try {
    server.on("error", (error) => {
      fail(error);
    });

    await waitForApp(port);

    for (const requestId of ["first", "second"]) {
      const response = await fetch(
        `http://127.0.0.1:${port}/track-custom-events/${requestId}`,
        { signal: AbortSignal.timeout(5000) }
      );
      equal(response.status, 200);
    }

    const customEvents = await waitForCustomEventsToSettle(token);
    equal(customEvents.length, 50);

    for (const requestId of ["first", "second"]) {
      const names = customEvents
        .filter((event) => event.name.startsWith(`${requestId}-`))
        .map((event) => event.name);
      const expectedNames = Array.from(
        { length: 25 },
        (_, index) => `${requestId}-${index}`
      );
      deepStrictEqual(new Set(names), new Set(expectedNames));
    }

    const warning =
      "Zen.track(...) was called more than 25 times during one request";
    equal(stderr.split(warning).length - 1, 2);
  } finally {
    server.kill();
  }
});
