import { spawn, spawnSync } from "child_process";
import { resolve } from "path";
import { once } from "events";
import { test } from "node:test";
import { doesNotMatch, equal, ifError, match } from "node:assert";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/fastify-esm-loader"
);

test("it preserves Fastify ESM imports and blocks attacks with Sentry", async () => {
  const server = spawn(
    process.execPath,
    [
      "--require",
      "@aikidosec/firewall/instrument",
      "--import",
      "./sentry.js",
      "./app.js",
      "0",
    ],
    {
      cwd: pathToAppDir,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15000,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        AIKIDO_TOKEN: "",
      },
    }
  );

  let stdout = "";
  let stderr = "";
  const listening = new Promise((resolve) => {
    server.stdout.on("data", (data) => {
      stdout += data.toString();
      const port = stdout.match(/Listening on port (\d+)/);
      if (port) {
        resolve(Number(port[1]));
      }
    });
  });
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  const closed = once(server, "close");

  try {
    const port = await Promise.race([
      listening,
      closed.then(([code, signal]) => {
        throw new Error(
          `App exited before listening (${code ?? signal})\n${stdout}\n${stderr}`
        );
      }),
    ]);
    const response = await fetch(`http://127.0.0.1:${port}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "test.txt" }),
      signal: AbortSignal.timeout(5000),
    });
    equal(response.status, 200);
    equal(await response.text(), "Hello, world!\n");

    const attack = await fetch(`http://127.0.0.1:${port}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "../package.json" }),
      signal: AbortSignal.timeout(5000),
    });
    equal(attack.status, 500);
    match(await attack.text(), /Zen has blocked a path traversal attack/);
    match(stdout, /Starting agent/);
  } finally {
    server.kill();
    await closed;
  }
});

test("it preserves Fastify ESM imports and blocks attacks with New Relic 14.8.0", async () => {
  const server = spawn(
    process.execPath,
    [
      "--require",
      "@aikidosec/firewall/instrument",
      "--import",
      "newrelic/esm-loader.mjs",
      "./app.js",
      "0",
    ],
    {
      cwd: pathToAppDir,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15000,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        AIKIDO_TOKEN: "",
        NEW_RELIC_ENABLED: "false",
      },
    }
  );

  let stdout = "";
  let stderr = "";
  const listening = new Promise((resolve) => {
    server.stdout.on("data", (data) => {
      stdout += data.toString();
      const port = stdout.match(/Listening on port (\d+)/);
      if (port) {
        resolve(Number(port[1]));
      }
    });
  });
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  const closed = once(server, "close");

  try {
    const port = await Promise.race([
      listening,
      closed.then(([code, signal]) => {
        throw new Error(
          `App exited before listening (${code ?? signal})\n${stdout}\n${stderr}`
        );
      }),
    ]);
    const response = await fetch(`http://127.0.0.1:${port}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "test.txt" }),
      signal: AbortSignal.timeout(5000),
    });
    equal(response.status, 200);
    equal(await response.text(), "Hello, world!\n");

    const attack = await fetch(`http://127.0.0.1:${port}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "../package.json" }),
      signal: AbortSignal.timeout(5000),
    });
    equal(attack.status, 500);
    match(await attack.text(), /Zen has blocked a path traversal attack/);
    match(stdout, /Starting agent/);
  } finally {
    server.kill();
    await closed;
  }

  doesNotMatch(stderr, /import-in-the-middle@\S+ may break/);
});

test("it warns about the incompatible loader in New Relic 13.20.0", () => {
  const { error, stderr } = spawnSync(
    process.execPath,
    [
      "--require",
      "@aikidosec/firewall/instrument",
      "--import",
      "newrelic-old/esm-loader.mjs",
      "--input-type=module",
      "--eval",
      "await import('fastify')",
    ],
    {
      cwd: pathToAppDir,
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_TOKEN: "",
        NEW_RELIC_ENABLED: "false",
      },
    }
  );

  ifError(error);
  match(
    stderr,
    /AIKIDO: import-in-the-middle@1\.15\.0 may break CommonJS module loading/
  );
  match(stderr, /Upgrade the monitoring agent.*import-in-the-middle >=3\.0\.2/);
  equal(stderr.match(/AIKIDO: import-in-the-middle@/g)?.length, 1);
});
