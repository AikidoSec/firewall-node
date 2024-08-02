const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-postgres",
  "app.js"
);

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
    .then(() => {
      return Promise.all([
        fetch(
          `http://localhost:4000/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(`http://localhost:4000/string-concat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petname: ["'", "1)", "(0,1)", "(1", "'"] }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://localhost:4000/?petname=Njuska", {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(async ([sqlInjection, sqlInjection2, normalSearch]) => {
      t.equal(sqlInjection.status, 500);
      t.equal(sqlInjection2.status, 500);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Aikido firewall has blocked an SQL injection/);
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
    console.log(data.toString());
    stdout += data.toString();
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    console.log(data.toString());
    stderr += data.toString();
  });

  // Wait for the server to start
  timeout(2000)
    .then(() =>
      Promise.all([
        fetch(
          `http://localhost:4001/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(`http://localhost:4001/string-concat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petname: ["'", "1)", "(0,1)", "(1", "'"] }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://localhost:4001/?petname=Njuska", {
          signal: AbortSignal.timeout(5000),
        }),
      ])
    )
    .then(async ([sqlInjection, sqlInjection2, normalSearch]) => {
      t.equal(sqlInjection.status, 200);
      console.log(await sqlInjection.text());
      t.equal(sqlInjection2.status, 200);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Aikido firewall has blocked an SQL injection/);
    })
    .catch((error) => {
      console.log(error);
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
