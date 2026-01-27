const t = require("tap");
const { spawn } = require("child_process");
const { resolve, join } = require("path");
const timeout = require("../timeout");

const appDir = resolve(__dirname, "../../sample-apps/hono-sqlite3-esm");
const pathToApp = join(appDir, "app.js");

t.test("it logs esm warnings", (t) => {
  const server = spawn(`node`, [pathToApp, "4004"], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
    cwd: appDir,
  });

  server.on("close", () => {
    t.end();
  });

  server.on("error", (err) => {
    t.fail(err.message);
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
  timeout(2000)
    .then(() => {
      return Promise.all([
        fetch("http://127.0.0.1:4004/add", {
          method: "POST",
          body: JSON.stringify({ name: "Test'), ('Test2');--" }),
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://127.0.0.1:4004/add", {
          method: "POST",
          body: JSON.stringify({ name: "Miau" }),
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([sqlInjection, normalAdd]) => {
      t.equal(sqlInjection.status, 200); // Not blocked
      t.equal(normalAdd.status, 200);
      t.match(stderr, /Your application seems to be running in ESM mode\./);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Zen has blocked an SQL injection/); // Not supported
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
