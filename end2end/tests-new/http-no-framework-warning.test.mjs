import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { equal, fail, match, doesNotMatch } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToCjsApp = resolve(
  import.meta.dirname,
  "../../sample-apps/http-no-framework"
);

const pathToEsmApp = resolve(
  import.meta.dirname,
  "../../sample-apps/http-no-framework-esm"
);

test("CJS: it warns when HTTP server is created without a web framework", async () => {
  const port = await getRandomPort();
  const server = spawn(`node`, ["app.js", port], {
    cwd: pathToCjsApp,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "true",
    },
  });

  server.on("error", (err) => {
    fail(`Failed to start subprocess: ${err}`);
  });

  let stdout = "";
  let stderr = "";

  server.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  await timeout(3000);

  const combined = stdout + stderr;

  match(
    combined,
    /Zen detected an HTTP server but no supported web framework/,
    "Expected warning about missing web framework"
  );

  server.kill();
});

test("ESM: it warns when HTTP server is created without a web framework", async () => {
  const port = await getRandomPort();
  const server = spawn(
    `node`,
    ["-r", "../../build/instrument/index.js", "app.mjs", port],
    {
      cwd: pathToEsmApp,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
      },
    }
  );

  server.on("error", (err) => {
    fail(`Failed to start subprocess: ${err}`);
  });

  let stdout = "";
  let stderr = "";

  server.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  await timeout(3000);

  const combined = stdout + stderr;

  match(
    combined,
    /Zen detected an HTTP server but no supported web framework/,
    "Expected warning about missing web framework"
  );

  server.kill();
});
