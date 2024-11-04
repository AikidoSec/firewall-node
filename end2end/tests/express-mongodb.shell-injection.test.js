const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const waitOn = require("../waitOn");
const getFreePort = require("../getFreePort");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mongodb",
  "app.js"
);

t.test("it blocks in blocking mode", (t) => {
  const port = getFreePort(t);
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, port], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCK: "true" },
  });

  server.on("close", () => {
    t.end();
  });

  server.on("error", (err) => {
    t.fail(err);
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
  waitOn(port)
    .then(() => {
      return Promise.all([
        fetch(`http://localhost:${port}/ls`, {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            directory: "'; ls ~",
          }),
        }),
        fetch(`http://localhost:${port}/ls`, {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            directory: ".",
          }),
        }),
      ]);
    })
    .then(([noSQLInjection, normalSearch]) => {
      t.equal(noSQLInjection.status, 500);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Zen has blocked a shell injection/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  const port = getFreePort(t);
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, port], {
    env: { ...process.env, AIKIDO_DEBUG: "true" },
  });

  server.on("close", () => {
    t.end();
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
  waitOn(port)
    .then(() =>
      Promise.all([
        fetch(`http://localhost:${port}/ls`, {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            directory: "'; ls ~; echo '",
          }),
        }),
        fetch(`http://localhost:${port}/ls`, {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            directory: ".",
          }),
        }),
      ])
    )
    .then(([noSQLInjection, normalSearch]) => {
      t.equal(noSQLInjection.status, 200);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Zen has blocked a shell injection/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
