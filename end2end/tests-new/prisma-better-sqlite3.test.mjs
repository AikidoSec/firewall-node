import { spawn } from "child_process";
import { resolve } from "path";
import { test, before } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";
import { promisify } from "util";
import { exec as execCb } from "child_process";

const execAsync = promisify(execCb);

const appDir = resolve(
  import.meta.dirname,
  "../../sample-apps/prisma-better-sqlite3"
);

process.env.DATABASE_URL = "file:./data/dev.db";

const port = await getRandomPort();
const port2 = await getRandomPort();

before(async () => {
  await execAsync(
    "npx prisma generate", // Generate prisma client
    {
      cwd: appDir,
    }
  );

  await execAsync(
    "npx prisma migrate reset --force", // Rset db and apply migrations
    {
      cwd: appDir,
    }
  );
});

test("it blocks request in blocking mode", async () => {
  const server = spawn(
    `node`,
    ["-r", "@aikidosec/firewall/instrument", "--import", "tsx", "app.ts", port],
    {
      cwd: appDir,
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
      console.log(data.toString());
      stdout += data.toString();
    });

    let stderr = "";
    server.stderr.on("data", (data) => {
      console.error(data.toString());
      stderr += data.toString();
    });

    // Wait for the server to start
    await timeout(2000);

    const [sqlInjection, normalAdd] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/posts/Test' OR 1=1 -- C`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port}/posts/Happy`, {
        method: "GET",
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

test("it does not block request in non-blocking mode", async () => {
  const server = spawn(
    `node`,
    [
      "-r",
      "@aikidosec/firewall/instrument",
      "--import",
      "tsx",
      "app.ts",
      port2,
    ],
    {
      cwd: appDir,
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
      console.log(data.toString());
      stdout += data.toString();
    });

    let stderr = "";
    server.stderr.on("data", (data) => {
      console.error(data.toString());
      stderr += data.toString();
    });

    // Wait for the server to start
    await timeout(2000);

    const [sqlInjection, normalAdd] = await Promise.all([
      fetch(`http://127.0.0.1:${port2}/posts/Test' OR 1=1 -- C`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port2}/posts/Happy`, {
        method: "GET",
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
