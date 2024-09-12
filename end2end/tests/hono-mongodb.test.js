const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/hono-mongodb",
  "app.js"
);

t.setTimeout(60000);

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, "4000"], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
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
    .then((a) => {
      return Promise.all([
        fetch("http://127.0.0.1:4000/search", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({ title: { $ne: null } }),
          headers: { "Content-Type": "application/json" },
        }),
        fetch("http://127.0.0.1:4000/search", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({ title: "title" }),
          headers: { "Content-Type": "application/json" },
        }),
      ]);
    })
    .then(([noSQLInjection, normalSearch]) => {
      t.equal(noSQLInjection.status, 500);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Aikido firewall has blocked a NoSQL injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, "4001"], {
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
  timeout(2000)
    .then((a) => {
      return Promise.all([
        fetch("http://127.0.0.1:4001/search", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({ title: { $ne: null } }),
          headers: { "Content-Type": "application/json" },
        }),
        fetch("http://127.0.0.1:4001/search", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({ title: "title" }),
          headers: { "Content-Type": "application/json" },
        }),
      ]);
    })
    .then(([noSQLInjection, normalSearch]) => {
      t.equal(noSQLInjection.status, 200);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Aikido firewall has blocked a NoSQL injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
