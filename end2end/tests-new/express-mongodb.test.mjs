import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { timeout } from "./utils/timeout.mjs";
import { getRandomPort } from "./utils/get-port.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/express-mongodb"
);
const port = await getRandomPort();
const port2 = await getRandomPort();

test("it blocks request in blocking mode", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port],
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

    const [noSqlInjection, jsInjection, normalRequest] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/?search[$ne]=null`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port}/where?title=Test%27%7C%7C%27a`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port}/?search=title`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(noSqlInjection.status, 500);
    equal(jsInjection.status, 500);
    equal(normalRequest.status, 200);
    match(stdout, /Starting agent/);
    match(stderr, /Zen has blocked a NoSQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block in dry mode", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port2],
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

    const [noSqlInjection, jsInjection, normalRequest] = await Promise.all([
      fetch(`http://127.0.0.1:${port2}/?search[$ne]=null`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port2}/where?title=Test%27%7C%7C%27a`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port2}/?search=title`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(noSqlInjection.status, 200);
    equal(jsInjection.status, 200);
    equal(normalRequest.status, 200);
    match(stdout, /Starting agent/);
    doesNotMatch(stderr, /Zen has blocked a NoSQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
