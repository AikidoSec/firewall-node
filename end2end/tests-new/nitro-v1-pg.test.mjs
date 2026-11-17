import { execSync, spawn } from "child_process";
import { resolve } from "path";
import { before, test } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/nitro-v1-postgres"
);
const port = await getRandomPort();
const port2 = await getRandomPort();

const sqlInjection = encodeURIComponent(
  "Njuska'); DELETE FROM cats_nitro;-- H"
);

before(() => {
  execSync("npx nitro build", { cwd: pathToAppDir, stdio: "ignore" });
});

function startServer(port, block) {
  return spawn(
    "node",
    [
      "--require",
      "@aikidosec/firewall/instrument",
      "./.output/server/index.mjs",
    ],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: block ? "true" : "false",
        PORT: port,
      },
    }
  );
}

test("it blocks request in blocking mode", async () => {
  const server = startServer(port, true);

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
    await timeout(3000);

    const [attack, normalAdd] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/?petname=${sqlInjection}`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port}/?petname=Njuska`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(attack.status, 500);
    equal(normalAdd.status, 200);
    match(stdout, /Starting agent/);
    match(stderr, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode", async () => {
  const server = startServer(port2, false);

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
    await timeout(3000);

    const [attack, normalAdd] = await Promise.all([
      fetch(`http://127.0.0.1:${port2}/?petname=${sqlInjection}`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port2}/?petname=Njuska`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(attack.status, 200);
    equal(normalAdd.status, 200);
    match(stdout, /Starting agent/);
    match(stdout, /Zen has detected an SQL injection/);
    doesNotMatch(stderr, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
