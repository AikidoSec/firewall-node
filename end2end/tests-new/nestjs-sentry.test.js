const { spawnSync, spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");
const { test, before } = require("node:test");
const { equal, fail, match, doesNotMatch } = require("node:assert");

const pathToAppDir = resolve(__dirname, "../../sample-apps/nestjs-sentry");
const port = "4007";
const port2 = "4008";

before(() => {
  const { stderr } = spawnSync(`npm`, ["run", "build"], {
    cwd: pathToAppDir,
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
});

test("it blocks request in blocking mode", async () => {
  const server = spawn(`node`, ["./dist/main.js"], {
    cwd: pathToAppDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "true",
      PORT: port,
    },
  });

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

    const [sqlInjection, normalAdd, outgoingReq] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/cats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Test'), ('Test2');--" }),
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port}/cats`, {
        method: "POST",
        body: JSON.stringify({ name: "Miau" }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port}/releases`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 500);
    equal(normalAdd.status, 201);
    equal(outgoingReq.status, 200);
    match(stdout, /Starting agent/);
    match(stderr, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it blocks request in blocking mode", async () => {
  const server = spawn(`node`, ["./dist/main.js"], {
    cwd: pathToAppDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "false",
      PORT: port2,
    },
  });

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

    const [sqlInjection, normalAdd, outgoingReq] = await Promise.all([
      fetch(`http://127.0.0.1:${port2}/cats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Test'), ('Test2');--" }),
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port2}/cats`, {
        method: "POST",
        body: JSON.stringify({ name: "Miau" }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port2}/releases`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 201);
    equal(normalAdd.status, 201);
    equal(outgoingReq.status, 200);
    match(stdout, /Starting agent/);
    doesNotMatch(stderr, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
