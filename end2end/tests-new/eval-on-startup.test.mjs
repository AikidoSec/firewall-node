import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { fail, match, doesNotMatch } from "node:assert";
import { timeout } from "./utils/timeout.mjs";
import { getRandomPort } from "./utils/get-port.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/eval-on-startup"
);
const port = await getRandomPort();
const port2 = await getRandomPort();
const port3 = await getRandomPort();

// With the flag, Node blocks the new Function() call at startup. Zen uses the same
// V8 hook, so this checks Zen does not register its callback and re-enable eval. If
// it did, the app would boot and this test would fail.
test("it lets Node block code generation when the flag is passed on the CLI", async () => {
  const server = spawn(
    `node`,
    [
      "--disallow-code-generation-from-strings",
      "--require",
      "@aikidosec/firewall/instrument",
      "./app.js",
      port,
    ],
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

    await timeout(2000);

    match(stderr, /Code generation from strings disallowed/);
    doesNotMatch(stdout, /Listening on port/);
    doesNotMatch(stderr, /Zen will NOT block code injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

// Same as above, but the flag comes from NODE_OPTIONS instead of the CLI.
test("it lets Node block code generation when the flag is set via NODE_OPTIONS", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port2],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        NODE_OPTIONS: "--disallow-code-generation-from-strings",
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

    match(stderr, /Code generation from strings disallowed/);
    doesNotMatch(stdout, /Listening on port/);
    doesNotMatch(stderr, /Zen will NOT block code injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

// Without the flag the app boots fine: there is no request, so Zen allows the
// startup new Function() call.
test("it starts normally without the flag", async () => {
  const server = spawn(
    `node`,
    ["--require", "@aikidosec/firewall/instrument", "./app.js", port3],
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

    await timeout(2000);

    match(stdout, /Code generation works, 1 \+ 1 = 2/);
    match(stdout, /Listening on port/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
