import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-pg-ts-esm"
);
const port = await getRandomPort();
const port2 = await getRandomPort();
const port3 = await getRandomPort();

const testServerUrl = "http://localhost:5874";

test("it blocks request in blocking mode", async () => {
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
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
      },
    }
  );

  try {
    server.on("error", (err) => {
      fail(err.message);
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

    const [sqlInjection, normalAdd] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/add`, {
        method: "POST",
        body: JSON.stringify({ name: "Njuska'); DELETE FROM cats_3;-- H" }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port}/add`, {
        method: "POST",
        body: JSON.stringify({ name: "Miau" }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 500);
    equal(normalAdd.status, 200);
    match(stdout, /Starting agent/);
    match(stderr, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode", async () => {
  const server = spawn(
    `node`,
    [
      "--require",
      "@aikidosec/firewall/instrument",
      "--experimental-strip-types",
      "./app.ts",
      port2,
    ],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "false",
      },
    }
  );

  try {
    server.on("error", (err) => {
      fail(err.message);
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

    const [sqlInjection, normalAdd] = await Promise.all([
      fetch(`http://127.0.0.1:${port2}/add`, {
        method: "POST",
        body: JSON.stringify({ name: "Njuska'); DELETE FROM cats_3;-- H" }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port2}/add`, {
        method: "POST",
        body: JSON.stringify({ name: "Miau" }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 200);
    equal(normalAdd.status, 200);
    match(stdout, /Starting agent/);
    doesNotMatch(stderr, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

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
      port3,
    ],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_DEBUG: "true",
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

    await fetch(`http://127.0.0.1:${port3}/`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    // Wait for heartbeat to be sent
    await timeout(35000);

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

    const heartbeatEvent = heartbeatEvents[0];

    equal(heartbeatEvent.hostnames.length, 1);

    const hostname = heartbeatEvent.hostnames[0];

    equal(hostname.hostname, "localhost");
    equal(hostname.hits, 2);
    equal(hostname.port, 5874);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
