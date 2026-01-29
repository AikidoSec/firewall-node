import { spawn } from "child_process";
import { resolve } from "path";
import { before, test } from "node:test";
import { equal, fail, match, doesNotMatch, ok } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";
import { spawnSync } from "node:child_process";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/rolldown-bundle"
);

const cjsAppDir = resolve(pathToAppDir, "dist/cjs");
const esmAppDir = resolve(pathToAppDir, "dist/esm");

const port = await getRandomPort();
const port2 = await getRandomPort();
const port3 = await getRandomPort();
const port4 = await getRandomPort();

before(() => {
  const { stderr } = spawnSync(`node`, ["--run", "build"], {
    cwd: pathToAppDir,
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
});

test("it blocks request in blocking mode (CJS)", async () => {
  const server = spawn(`node`, ["./app-cjs.js", port], {
    cwd: cjsAppDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "true",
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
    match(
      stderr,
      / The new instrumentation system with ESM support is still under active development/
    );
    doesNotMatch(stderr, /Zen has already been initialized/);
    doesNotMatch(
      stderr,
      /Your application seems to be using a bundler without using the Zen bundler plugin./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode (CJS)", async () => {
  const server = spawn(`node`, ["./app-cjs.js", port2], {
    cwd: cjsAppDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "false",
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
    match(
      stderr,
      / The new instrumentation system with ESM support is still under active development/
    );
    doesNotMatch(stderr, /Zen has already been initialized/);
    doesNotMatch(
      stderr,
      /Your application seems to be using a bundler without using the Zen bundler plugin./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it blocks request in blocking mode (ESM)", async () => {
  const server = spawn(
    `node`,
    ["-r", "@aikidosec/firewall/instrument", "./app-esm.js", port3],
    {
      cwd: esmAppDir,
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
        body: JSON.stringify({ name: "Njuska'); DELETE FROM cats_3;-- H" }),
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
    match(
      stderr,
      / The new instrumentation system with ESM support is still under active development/
    );
    doesNotMatch(stderr, /Zen has already been initialized/);
    doesNotMatch(
      stderr,
      /Your application seems to be using a bundler without using the Zen bundler plugin./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode (ESM)", async () => {
  const server = spawn(
    `node`,
    ["-r", "@aikidosec/firewall/instrument", "./app-esm.js", port4],
    {
      cwd: esmAppDir,
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
      fetch(`http://127.0.0.1:${port4}/add`, {
        method: "POST",
        body: JSON.stringify({ name: "Njuska'); DELETE FROM cats_3;-- H" }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port4}/add`, {
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
    match(
      stderr,
      / The new instrumentation system with ESM support is still under active development/
    );
    doesNotMatch(stderr, /Zen has already been initialized/);
    doesNotMatch(
      stderr,
      /Your application seems to be using a bundler without using the Zen bundler plugin./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
