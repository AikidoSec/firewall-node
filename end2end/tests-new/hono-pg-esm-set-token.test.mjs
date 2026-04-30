import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, ok } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-pg-esm"
);

const testServerUrl = "http://localhost:5874";

test(
  "it blocks after setToken is called and sends a heartbeat (ESM)",
  { timeout: 60000 },
  async () => {
    const port = await getRandomPort();

    const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
      method: "POST",
    });
    const body = await response.json();
    const token = body.token;

    const server = spawn(
      `node`,
      ["--require", "./zen-setup.cjs", "./app-set-token.js", port],
      {
        cwd: pathToAppDir,
        env: {
          ...process.env,
          AIKIDO_INSTRUMENT: "true",
          TEST_AIKIDO_TOKEN: token,
          AIKIDO_ENDPOINT: testServerUrl,
          AIKIDO_REALTIME_ENDPOINT: testServerUrl,
          AIKIDO_DEBUG: "true",
          AIKIDO_BLOCK: "true",
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

      // Wait for server + setToken (500ms delay in app)
      await timeout(2000);

      const [sqlInjection, normalAdd] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/add`, {
          method: "POST",
          body: JSON.stringify({
            name: "Njuska'); DELETE FROM cats_6;-- H",
          }),
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://127.0.0.1:${port}/add`, {
          method: "POST",
          body: JSON.stringify({ name: "Miau" }),
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        }),
      ]);

      equal(sqlInjection.status, 500);
      equal(normalAdd.status, 200);
      ok(stdout.includes("Starting agent"), "should log starting agent");
      ok(
        stderr.includes("Zen has blocked an SQL injection"),
        "should log blocked SQL injection"
      );

      // Wait for heartbeat (agent sends after ~30s)
      await timeout(31000);

      const eventsResponse = await fetch(
        `${testServerUrl}/api/runtime/events`,
        {
          method: "GET",
          headers: { Authorization: token },
          signal: AbortSignal.timeout(5000),
        }
      );

      const events = await eventsResponse.json();
      const startedEvents = events.filter((e) => e.type === "started");
      equal(startedEvents.length, 1, "should have 1 started event");

      const heartbeatEvents = events.filter((e) => e.type === "heartbeat");
      equal(heartbeatEvents.length, 1, "should have 1 heartbeat event");
    } catch (err) {
      fail(err);
    } finally {
      server.kill();
    }
  }
);
