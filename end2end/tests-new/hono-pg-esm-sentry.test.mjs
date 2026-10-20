import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-pg-esm"
);
const port = await getRandomPort();
const port2 = await getRandomPort();
const port3 = await getRandomPort();

const majorVersion = parseInt(process.version.slice(1).split(".")[0], 10);

const opts = {
  skip:
    majorVersion < 25
      ? "Node.js 25+ is required for ESM instrumentation to work with Sentry"
      : false,
};

test("it blocks request in blocking mode", opts, async () => {
  const server = spawn(
    `node`,
    [
      "--require",
      "@aikidosec/firewall/instrument",
      "--import",
      "./sentry.js",
      "./app.js",
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
        body: JSON.stringify({ name: "Njuska', 1); DELETE FROM cats_6;-- H" }),
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

test("it does not block request in monitoring mode", opts, async () => {
  const server = spawn(
    `node`,
    [
      "--require",
      "@aikidosec/firewall/instrument",
      "--import",
      "./sentry.js",
      "./app.js",
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
        body: JSON.stringify({ name: "Njuska', 1); DELETE FROM cats_6;-- H" }),
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

test(
  "it blocks request in blocking mode (Sentry imported first)",
  opts,
  async () => {
    const server = spawn(
      `node`,
      [
        "--import",
        "./sentry.js",
        "--require",
        "@aikidosec/firewall/instrument",
        "./app.js",
        port3,
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
        fetch(`http://127.0.0.1:${port3}/add`, {
          method: "POST",
          body: JSON.stringify({ name: "Njuska'); DELETE FROM cats_6;-- H" }),
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://127.0.0.1:${port3}/add`, {
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
  }
);
