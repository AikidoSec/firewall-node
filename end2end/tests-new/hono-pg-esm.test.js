const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");
const { test } = require("node:test");
const { builtinModules } = require("module");
const { equal, fail, match, doesNotMatch } = require("node:assert");

const pathToAppDir = resolve(__dirname, "../../sample-apps/hono-pg-esm");
const testServerUrl = "http://localhost:5874";
const port = "4004";
const port2 = "4005";
const port3 = "4006";

test("it blocks request in blocking mode", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port],
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
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it does not block request in monitoring mode", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port2],
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
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("it reports packages in heartbeat with ESM instrumentation", async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;

  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port3],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "false",
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
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

    // Wait for the heartbeat event to be sent
    await timeout(32000);

    const eventsResponse = await fetch(`${testServerUrl}/api/runtime/events`, {
      method: "GET",
      headers: {
        Authorization: token,
      },
      signal: AbortSignal.timeout(5000),
    });

    const events = await eventsResponse.json();
    const heartbeatEvents = events.filter(
      (event) => event.type === "heartbeat"
    );

    if (heartbeatEvents.length === 0) {
      fail("No heartbeat events found");
    }

    const [heartbeat] = heartbeatEvents;

    // Verify packages are reported
    if (!heartbeat.packages || !Array.isArray(heartbeat.packages)) {
      fail("Heartbeat should contain packages array");
    }

    const expectedPackages = [
      "@aikidosec/firewall",
      "hono",
      "pg",
      "@hono/node-server",
      "xtend",
      "postgres-array",
    ];
    const packageNames = heartbeat.packages.map((pkg) => pkg.name);
    for (const pkg of expectedPackages) {
      if (!packageNames.includes(pkg)) {
        fail(`Expected package ${pkg} to be reported in heartbeat`);
      }
    }

    // Verify no builtin modules are reported
    for (const builtinName of builtinModules) {
      if (packageNames.includes(builtinName)) {
        fail(
          `Builtin module ${builtinName} should not be included in packages`
        );
      }
    }

    // No package should have node: prefix
    for (const pkg of heartbeat.packages) {
      if (pkg.name.startsWith("node:")) {
        fail(`Package ${pkg.name} should not have node: prefix`);
      }
    }
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
