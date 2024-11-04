const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const waitOn = require("../waitOn");
const getFreePort = require("../getFreePort");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mysql2",
  "app.js"
);

t.test("it blocks in blocking mode", (t) => {
  const port = getFreePort(t);
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, port], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
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
        fetch(
          `http://127.0.0.1:${port}/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(
          `http://127.0.0.1:${port}/cats/${encodeURIComponent("Njuska'; DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(`http://127.0.0.1:${port}/?petname=Njuska`, {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([sqlInjection, sqlInjection2, normalSearch]) => {
      t.equal(sqlInjection.status, 500);
      t.equal(sqlInjection2.status, 500);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Zen has blocked an SQL injection/);
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
        fetch(
          `http://127.0.0.1:${port}/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(
          `http://127.0.0.1:${port}/cats/${encodeURIComponent("Njuska'; DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(`http://127.0.0.1:${port}/?petname=Njuska`, {
          signal: AbortSignal.timeout(5000),
        }),
      ])
    )
    .then(([sqlInjection, sqlInjection2, normalSearch]) => {
      t.equal(sqlInjection.status, 200);
      t.equal(sqlInjection2.status, 200);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Zen has blocked an SQL injection/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
