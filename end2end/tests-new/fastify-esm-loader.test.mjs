import { spawn } from "child_process";
import { resolve } from "path";
import { once } from "events";
import { test } from "node:test";
import { equal, match } from "node:assert";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/fastify-esm-loader"
);

for (const [name, loader] of [
  ["Sentry", "./sentry.js"],
  ["New Relic", "newrelic/esm-loader.mjs"],
]) {
  test(`it preserves Fastify ESM imports and blocks attacks with ${name}`, async () => {
    const server = spawn(
      process.execPath,
      [
        "--require",
        "@aikidosec/firewall/instrument",
        "--import",
        loader,
        "./app.js",
        "0",
      ],
      {
        cwd: pathToAppDir,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
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
    server.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    server.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    const closed = once(server, "close");

    try {
      const [{ port }] = await Promise.race([
        once(server, "message"),
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
}
