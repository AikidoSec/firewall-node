import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, match, doesNotMatch, ok } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";
import { spawnSync } from "node:child_process";
import { join } from "path";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/esbuild-bundle"
);
const port = await getRandomPort();
const port2 = await getRandomPort();
const port3 = await getRandomPort();
const port4 = await getRandomPort();

function buildApp(format, appPath) {
  const { stderr } = spawnSync(`node`, ["./build.mjs"], {
    cwd: pathToAppDir,
    env: {
      ...process.env,
      BUNDLE_FORMAT: format,
      APP_PATH: appPath,
    },
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
}

test("it blocks request in blocking mode (CJS)", async () => {
  buildApp("cjs", "src/app-cjs.ts");

  const server = spawn(`node`, ["./build/app-cjs.js", port], {
    cwd: pathToAppDir,
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
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode (CJS)", async () => {
  buildApp("cjs", "src/app-cjs.ts");

  const server = spawn(`node`, ["./build/app-cjs.js", port2], {
    cwd: pathToAppDir,
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
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it blocks request in blocking mode (ESM)", async () => {
  buildApp("esm", "src/app-esm.ts");

  const server = spawn(
    `node`,
    ["-r", "@aikidosec/firewall/instrument", "./app-esm.js", port3],
    {
      cwd: join(pathToAppDir, "build"),
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
      /Your application seems to be running in ESM mode. You need to use the new hook system to enable Zen. See our ESM documentation for setup instructions./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode (ESM)", async () => {
  buildApp("esm", "src/app-esm.ts");

  const server = spawn(
    `node`,
    ["-r", "@aikidosec/firewall/instrument", "./app-esm.js", port4],
    {
      cwd: join(pathToAppDir, "build"),
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
      /Your application seems to be running in ESM mode. You need to use the new hook system to enable Zen. See our ESM documentation for setup instructions./
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it throws error when Zen is initialized wrong", async () => {
  try {
    buildApp("esm", "src/app-cjs.ts");
    fail("Build should have failed but didn't");
  } catch (err) {
    ok(
      err.message.includes(
        "Aikido: Detected import of '@aikidosec/firewall/instrument' in your code while building an ESM bundle. Please remove this import and preload the library by running Node.js with the --require option instead. See our ESM documentation for more information."
      )
    );
  }

  try {
    buildApp("cjs", "src/app-esm.ts");
    fail("Build should have failed but didn't");
  } catch (err) {
    ok(
      err.message.includes(
        "Aikido: Missing import of '@aikidosec/firewall/instrument' in your code while building a CJS bundle."
      )
    );
  }
});
