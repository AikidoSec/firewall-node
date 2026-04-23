import { spawn } from "child_process";
import { resolve } from "path";
import { before, test } from "node:test";
import { equal, match, doesNotMatch } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";
import { spawnSync } from "node:child_process";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/loopback4-psql"
);

const port = await getRandomPort();
const port2 = await getRandomPort();

before(async () => {
  const { stderr } = spawnSync(`npm`, ["run", "build"], {
    cwd: pathToAppDir,
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
});

test("it blocks SQL injection in blocking mode", async () => {
  const server = spawn(`node`, ["dist/index.js"], {
    cwd: pathToAppDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      PORT: port,
      HOST: "127.0.0.1",
    },
  });

  try {
    server.on("error", (err) => {
      throw err;
    });

    let stdout = "";
    server.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    let stderr = "";
    server.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    await timeout(3000);

    const [sqlInjection, normalRequest, sqlInjectionPath, normalRequestPath] =
      await Promise.all([
        fetch(`http://127.0.0.1:${port}/insecure-sql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "admin'); DROP TABLE users;-- -",
          }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://127.0.0.1:${port}/insecure-sql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "admin" }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch(
          `http://127.0.0.1:${port}/insecure-sql/${encodeURIComponent("admin' OR '1'='1")}`,
          { signal: AbortSignal.timeout(5000) }
        ),
        fetch(`http://127.0.0.1:${port}/insecure-sql/admin`, {
          signal: AbortSignal.timeout(5000),
        }),
      ]);

    equal(sqlInjection.status, 500);
    equal(normalRequest.status, 200);
    equal(sqlInjectionPath.status, 500);
    equal(normalRequestPath.status, 200);
    match(stdout, /Starting agent/);

    match(stderr, /Zen has blocked an SQL injection/);
  } finally {
    server.kill();
  }
});

test("it does not block SQL injection in monitoring mode", async () => {
  const server = spawn(`node`, ["dist/index.js"], {
    cwd: pathToAppDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "false",
      PORT: port2,
      HOST: "127.0.0.1",
    },
  });

  try {
    server.on("error", (err) => {
      throw err;
    });

    let stdout = "";
    server.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    let stderr = "";
    server.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    await timeout(3000);

    const [sqlInjection, sqlInjectionPath] = await Promise.all([
      fetch(`http://127.0.0.1:${port2}/insecure-sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "admin'); DROP TABLE users;-- -",
        }),
        signal: AbortSignal.timeout(5000),
      }),
      fetch(
        `http://127.0.0.1:${port2}/insecure-sql/${encodeURIComponent("admin' OR '1'='1")}`,
        { signal: AbortSignal.timeout(5000) }
      ),
    ]);

    match(stdout, /Starting agent/);
    doesNotMatch(await sqlInjection.text(), /Zen has blocked an SQL injection/);
    doesNotMatch(
      await sqlInjectionPath.text(),
      /Zen has blocked an SQL injection/
    );
  } finally {
    server.kill();
  }
});
