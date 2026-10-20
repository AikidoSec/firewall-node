import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/fastify-kysely"
);
const port = await getRandomPort();
const port2 = await getRandomPort();

test("it blocks request in blocking mode", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.ts", port],
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
      fetch(
        `http://127.0.0.1:${port}/?petname=Njuska', '1'); DELETE FROM "catsKysely";-- H`,
        {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }
      ),
      fetch(`http://127.0.0.1:${port}/?petname=Miau`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 500);
    equal(normalAdd.status, 200);
    match(stdout, /Starting agent/);

    const body = await sqlInjection.text();
    match(body, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.ts", port2],
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
      fetch(
        `http://127.0.0.1:${port2}/?petname=Njuska'); DELETE FROM "catsKysely";-- H`,
        {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }
      ),
      fetch(`http://127.0.0.1:${port2}/?petname=Miau`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(sqlInjection.status, 200);
    equal(normalAdd.status, 200);
    match(stdout, /Starting agent/);
    doesNotMatch(stderr, /Zen has blocked an SQL injection/);
    doesNotMatch(
      stderr,
      /Zen does not instrument worker threads. Zen will only be active in the main thread./
    );

    const body = await sqlInjection.text();
    doesNotMatch(body, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
