import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, match } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/express5-esm"
);

const port = await getRandomPort();

test("it blocks SSRF via http.request in ESM mode", async () => {
  const server = spawn(
    `node`,
    ["--import", "@aikidosec/firewall/instrument", "./app.js", port],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCKING: "true",
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

    await timeout(2000);

    const [safeRequest, ssrfRequest] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/http-request?url=https://aikido.dev`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(
        `http://127.0.0.1:${port}/http-request?url=${encodeURIComponent("http://local.aikido.io:5875")}`,
        { signal: AbortSignal.timeout(5000) }
      ),
    ]);

    equal(safeRequest.status, 200);
    equal(ssrfRequest.status, 500);
    match(stdout, /Starting agent/);
    match(stderr, /Zen has blocked a server-side request forgery/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
