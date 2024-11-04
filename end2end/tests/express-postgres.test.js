const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const waitOn = require("../waitOn");
const getFreePort = require("../getFreePort");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-postgres",
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
          `http://localhost:${port}/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats_2;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(`http://localhost:${port}/string-concat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petname: ["'", "1)", "(0,1)", "(1", "'"] }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch(
          `http://localhost:${port}/string-concat?petname='&petname=1)&petname=(0,1)&petname=(1&petname='`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(`http://localhost:${port}/?petname=Njuska`, {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(
      async ([sqlInjection, sqlInjection2, sqlInjection3, normalSearch]) => {
        t.equal(sqlInjection.status, 500);
        t.equal(sqlInjection2.status, 500);
        t.equal(sqlInjection3.status, 500);
        t.equal(normalSearch.status, 200);
        t.match(stdout, /Starting agent/);
        t.match(stderr, /Zen has blocked an SQL injection/);
      }
    )
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
          `http://localhost:${port}/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats_2;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(`http://localhost:${port}/string-concat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petname: ["'", "1)", "(0,1)", "(1", "'"] }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch(
          `http://localhost:${port}/string-concat?petname='&petname=1)&petname=(0,1)&petname=(1&petname='`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(`http://localhost:${port}/?petname=Njuska`, {
          signal: AbortSignal.timeout(5000),
        }),
      ])
    )
    .then(
      async ([sqlInjection, sqlInjection2, sqlInjection3, normalSearch]) => {
        t.equal(sqlInjection.status, 200);
        t.equal(sqlInjection2.status, 200);
        t.equal(sqlInjection3.status, 200);
        t.equal(normalSearch.status, 200);
        t.match(stdout, /Starting agent/);
        t.notMatch(stderr, /Zen has blocked an SQL injection/);
      }
    )
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
