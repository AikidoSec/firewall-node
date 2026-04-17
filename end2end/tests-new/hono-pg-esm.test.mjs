import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { builtinModules } from "module";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-pg-esm"
);
const testServerUrl = "http://localhost:5874";
const port = await getRandomPort();
const port2 = await getRandomPort();
const port3 = await getRandomPort();
const port4 = await getRandomPort();
const port5 = await getRandomPort();
const port6 = await getRandomPort();
const port7 = await getRandomPort();

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
        body: JSON.stringify({ name: "Njuska'); DELETE FROM cats_6;-- H" }),
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
        body: JSON.stringify({
          name: "Njuska', '1'); DELETE FROM cats_6;-- H",
        }),
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
    doesNotMatch(
      stderr,
      /Zen does not instrument worker threads. Zen will only be active in the main thread./
    );
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

    for (const builtinName of builtinModules) {
      if (packageNames.includes(builtinName)) {
        fail(
          `Builtin module ${builtinName} should not be included in packages`
        );
      }
    }

    for (const pkg of heartbeat.packages) {
      if (pkg.name.startsWith("node:")) {
        fail(`Did not expect package name to start with node: ${pkg.name}`);
      }
    }
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("if bypass IP is set, attack waves are ignored for that IP", async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;

  await fetch(`${testServerUrl}/api/runtime/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      allowedIPAddresses: ["1.2.3.4"],
    }),
  });

  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port4],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
        AIKIDO_DEBUG: "true",
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

    await Promise.all(
      Array.from({ length: 15 }).map(() =>
        fetch(`http://localhost:${port4}/.env`, {
          headers: {
            "x-forwarded-for": "1.2.3.4",
          },
        })
      )
    );

    // Wait for the attack wave event to be sent
    await timeout(2000);

    const eventsResponse = await fetch(`${testServerUrl}/api/runtime/events`, {
      method: "GET",
      headers: {
        Authorization: token,
      },
      signal: AbortSignal.timeout(5000),
    });

    const events = await eventsResponse.json();
    const attackWaveEvents = events.filter(
      (event) => event.type === "detected_attack_wave"
    );
    equal(attackWaveEvents.length, 0);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("if IP is blocked, attack waves are not counted for that IP", async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;

  // Configure blocked IPs
  await fetch(`${testServerUrl}/api/runtime/firewall/lists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      blockedIPAddresses: ["9.8.7.6"],
    }),
  });

  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port5],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
        AIKIDO_DEBUG: "true",
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

    // Make 15+ requests to a suspicious path from a blocked IP
    // These should be blocked and NOT count towards attack waves
    const responses = await Promise.all(
      Array.from({ length: 16 }).map(() =>
        fetch(`http://localhost:${port5}/.env`, {
          headers: {
            "x-forwarded-for": "9.8.7.6",
          },
        })
      )
    );

    // All requests should be blocked with 403
    for (const resp of responses) {
      equal(resp.status, 403);
    }

    // Wait for any attack wave event to be sent
    await timeout(2000);

    const eventsResponse = await fetch(`${testServerUrl}/api/runtime/events`, {
      method: "GET",
      headers: {
        Authorization: token,
      },
      signal: AbortSignal.timeout(5000),
    });

    const events = await eventsResponse.json();
    const attackWaveEvents = events.filter(
      (event) => event.type === "detected_attack_wave"
    );
    // No attack wave events should be generated for blocked IPs
    equal(attackWaveEvents.length, 0);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("if bot is blocked, attack waves are not counted for that bot", async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  const token = body.token;

  // Configure blocked user agents
  await fetch(`${testServerUrl}/api/runtime/firewall/lists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      blockedIPAddresses: [],
      blockedUserAgents: "hacker|attacker",
    }),
  });

  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port6],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
        AIKIDO_DEBUG: "true",
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

    // Make 15+ requests to a suspicious path from a blocked bot
    // These should be blocked and NOT count towards attack waves
    const responses = await Promise.all(
      Array.from({ length: 16 }).map(() =>
        fetch(`http://localhost:${port6}/.env`, {
          headers: {
            "user-agent": "hacker",
          },
        })
      )
    );

    // All requests should be blocked with 403
    for (const resp of responses) {
      equal(resp.status, 403);
    }

    // Wait for any attack wave event to be sent
    await timeout(2000);

    const eventsResponse = await fetch(`${testServerUrl}/api/runtime/events`, {
      method: "GET",
      headers: {
        Authorization: token,
      },
      signal: AbortSignal.timeout(5000),
    });

    const events = await eventsResponse.json();
    const attackWaveEvents = events.filter(
      (event) => event.type === "detected_attack_wave"
    );
    // No attack wave events should be generated for blocked bots
    equal(attackWaveEvents.length, 0);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("IDOR protection works", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port7],
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

    const [idorBypass, normalAdd] = await Promise.all([
      fetch(`http://127.0.0.1:${port7}/add`, {
        method: "POST",
        headers: {
          "x-user-id": "2",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Njuska",
          withIdorProtection: true,
        }),
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`http://127.0.0.1:${port7}/add`, {
        method: "POST",
        body: JSON.stringify({ name: "Miau", withIdorProtection: true }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    equal(idorBypass.status, 500);
    equal(normalAdd.status, 200);
    match(stdout, /Starting agent/);
    match(
      stderr,
      /Zen IDOR protection: INSERT on table 'cats_6_with_idor' sets 'user_id' to '1' but tenant ID is '2'/
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
