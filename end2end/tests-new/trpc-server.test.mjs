import { spawn, spawnSync } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/trpc-server"
);
const port = await getRandomPort();
const port2 = await getRandomPort();
const port3 = await getRandomPort();
const port4 = await getRandomPort();

test("it blocks request in blocking mode", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./server/index.ts"],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        PORT: port.toString(),
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

    const testsProc = spawnSync(`node`, ["./client/index.ts"], {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_BLOCK: "true",
        PORT: port.toString(),
      },
    });

    if (testsProc.status !== 0) {
      console.error(testsProc.stdout.toString());
      console.error(testsProc.stderr.toString());
      fail("Client tests failed");
    }

    await timeout(2000);

    equal(testsProc.status, 0, "Client tests should pass");
    match(stdout, /Starting agent/);
    match(stdout, /Zen has blocked an SQL injection/);
    doesNotMatch(
      stdout,
      /Zen does not instrument worker threads. Zen will only be active in the main thread./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in non-blocking mode", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./server/index.ts"],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "false",
        PORT: port2.toString(),
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

    const testsProc = spawnSync(`node`, ["./client/index.ts"], {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_BLOCK: "false",
        PORT: port2.toString(),
      },
    });

    if (testsProc.status !== 0) {
      console.error(testsProc.stdout.toString());
      console.error(testsProc.stderr.toString());
      fail("Client tests failed");
    }

    await timeout(2000);

    equal(testsProc.status, 0, "Client tests should pass");
    match(stdout, /Starting agent/);
    doesNotMatch(stdout, /Zen has blocked an SQL injection/);
    doesNotMatch(
      stdout,
      /Zen does not instrument worker threads. Zen will only be active in the main thread./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it blocks request in blocking mode (express)", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./server/express.ts"],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        PORT: port3.toString(),
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

    const testsProc = spawnSync(`node`, ["./client/index.ts"], {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_BLOCK: "true",
        PORT: port3.toString(),
      },
    });

    if (testsProc.status !== 0) {
      console.error(testsProc.stdout.toString());
      console.error(testsProc.stderr.toString());
      fail("Client tests failed");
    }

    await timeout(2000);

    equal(testsProc.status, 0, "Client tests should pass");
    match(stdout, /Starting agent/);
    match(stdout, /Zen has blocked an SQL injection/);
    doesNotMatch(
      stdout,
      /Zen does not instrument worker threads. Zen will only be active in the main thread./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in non-blocking mode (express)", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./server/express.ts"],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "false",
        PORT: port4.toString(),
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

    const testsProc = spawnSync(`node`, ["./client/index.ts"], {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_BLOCK: "false",
        PORT: port4.toString(),
      },
    });

    if (testsProc.status !== 0) {
      console.error(testsProc.stdout.toString());
      console.error(testsProc.stderr.toString());
      fail("Client tests failed");
    }

    await timeout(2000);

    equal(testsProc.status, 0, "Client tests should pass");
    match(stdout, /Starting agent/);
    doesNotMatch(stdout, /Zen has blocked an SQL injection/);
    doesNotMatch(
      stdout,
      /Zen does not instrument worker threads. Zen will only be active in the main thread./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
