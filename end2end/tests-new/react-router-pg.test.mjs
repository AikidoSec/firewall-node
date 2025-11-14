import { getRandomPort } from "./utils/get-port.mjs";
import { spawnSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { timeout } from "./utils/timeout.mjs";
import { test, before } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/react-router-pg"
);

const port = await getRandomPort();
const port2 = await getRandomPort();

before(() => {
  const { stderr, status } = spawnSync("npm", ["run", "build"], {
    cwd: pathToAppDir,
  });

  if (status !== 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
});

test("it blocks request in blocking mode", async () => {
  const server = spawn(
    `node_modules/.bin/react-router-serve`,
    ["./build/server/index.js"],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        NODE_OPTIONS: "-r @aikidosec/firewall/instrument",
        PORT: port,
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

    const formData1 = new FormData();
    formData1.append("catname", "Kitty'); DELETE FROM cats_5;-- H");

    const formData2 = new FormData();
    formData2.append("catname", "Miau");

    const [sqlInjection, normalAdd] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/add-cat`, {
        method: "POST",
        body: formData1,
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port}/add-cat`, {
        method: "POST",
        body: formData2,
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 500);
    equal(normalAdd.status, 302); // Redirect after successful add
    match(stdout, /Starting agent/);
    match(stderr, /Zen has blocked an SQL injection/);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode", async () => {
  const server = spawn(
    `node_modules/.bin/react-router-serve`,
    ["./build/server/index.js"],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "false",
        NODE_OPTIONS: "-r @aikidosec/firewall/instrument",
        PORT: port2,
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

    const formData1 = new FormData();
    formData1.append("catname", "Kitty'); DELETE FROM cats_5;-- H");

    const formData2 = new FormData();
    formData2.append("catname", "Miau");

    const [sqlInjection, normalAdd] = await Promise.all([
      fetch(`http://127.0.0.1:${port2}/add-cat`, {
        method: "POST",
        body: formData1,
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port2}/add-cat`, {
        method: "POST",
        body: formData2,
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 302); // Redirect even with SQL injection
    equal(normalAdd.status, 302);
    match(stdout, /Starting agent/);
    doesNotMatch(stderr, /Zen has blocked an SQL injection/);
  } finally {
    server.kill();
  }
});
