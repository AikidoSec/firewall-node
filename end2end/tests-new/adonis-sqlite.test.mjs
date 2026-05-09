import { getRandomPort } from "./utils/get-port.mjs";

import { spawnSync, spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { timeout } from "./utils/timeout.mjs";
import { test, before } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { mkdirSync } from "node:fs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/adonis-sqlite"
);
const pathToAppBuildDir = resolve(pathToAppDir, "build/");

const port = await getRandomPort();
const port2 = await getRandomPort();

const envVars = {
  TZ: "UTC",
  HOST: "localhost",
  LOG_LEVEL: "info",
  APP_KEY: "12345678901234567890123456789012",
  NODE_ENV: "development",
  HOST: "127.0.0.1",
  ...process.env,
};

before(() => {
  const { stderr } = spawnSync(`node`, ["ace", "build"], {
    cwd: pathToAppDir,
    env: envVars,
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }

  mkdirSync(join(pathToAppBuildDir, "tmp"));

  const { stderr2 } = spawnSync(`node`, ["ace", "db:seed"], {
    cwd: pathToAppBuildDir,
    env: {
      ...envVars,
      PORT: port,
    },
  });

  if (stderr2 && stderr2.toString().length > 0) {
    throw new Error(`Failed to seed database: ${stderr2.toString()}`);
  }

  const { stderr3 } = spawnSync(`node`, ["ace", "migration:run"], {
    cwd: pathToAppBuildDir,
    env: {
      ...envVars,
      PORT: port,
    },
  });

  if (stderr3 && stderr3.toString().length > 0) {
    throw new Error(`Failed to migrate database: ${stderr3.toString()}`);
  }
});

test("it blocks request in blocking mode", async () => {
  const server = spawn(
    `node`,
    ["-r", "@aikidosec/firewall/instrument", "bin/server.js"],
    {
      cwd: pathToAppBuildDir,
      env: {
        ...envVars,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        PORT: port,
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

    const [sqlInjection, normalGet] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/users?id=1 -- comment`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port}/users?id=1`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 500);
    equal(normalGet.status, 200);
    match(stdout, /Starting agent/);
    match(stdout, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode", async () => {
  const server = spawn(
    `node`,
    ["-r", "@aikidosec/firewall/instrument", "bin/server.js"],
    {
      cwd: pathToAppBuildDir,
      env: {
        ...envVars,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "false",
        PORT: port2,
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

    const [sqlInjection, normalGet] = await Promise.all([
      fetch(`http://127.0.0.1:${port2}/users?id=1 -- comment`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port2}/users?id=1`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 200);
    equal(normalGet.status, 200);
    match(stdout, /Starting agent/);
    doesNotMatch(stdout, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
