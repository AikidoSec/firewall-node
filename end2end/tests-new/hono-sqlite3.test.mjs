import { spawn } from "node:child_process";
import { equal, fail, match } from "node:assert";
import { test } from "node:test";
import { resolve } from "node:path";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/hono-sqlite3"
);
const port = await getRandomPort();

test("it keeps blocking SQL injections after deeply nested parentheses", async () => {
  const server = spawn(
    "node",
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

    let stderr = "";
    server.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    await timeout(2000);

    const deeplyNestedResponse = await fetch(`http://127.0.0.1:${port}/add`, {
      method: "POST",
      body: JSON.stringify({ name: `'); ${"(".repeat(10_000)}` }),
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    equal(deeplyNestedResponse.status, 200);

    const injectionResponse = await fetch(`http://127.0.0.1:${port}/add`, {
      method: "POST",
      body: JSON.stringify({ name: "Test'), ('Test2');--" }),
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    equal(injectionResponse.status, 500);
    match(stderr, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
