const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mongodb",
  "app.js"
);

t.setTimeout(60000);

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4000"], {
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
  timeout(2000)
    .then(() => {
      return Promise.all([
        fetch("http://127.0.0.1:4000/hello/hans", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://127.0.0.1:4000/hello/${encodeURIComponent(`hans" //`)}`, {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([safeName, unsafeName]) => {
      t.equal(safeName.status, 200);
      t.equal(unsafeName.status, 500);
      t.match(stdout, /Starting agent/);
      t.match(stdout, /Zen has blocked a JavaScript injection/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4001"], {
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
    .then(() =>
      Promise.all([
        fetch("http://127.0.0.1:4001/hello/hans", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://127.0.0.1:4001/hello/${encodeURIComponent(`hans" //`)}`, {
          signal: AbortSignal.timeout(5000),
        }),
      ])
    )
    .then(([safeName, unsafeName]) => {
      t.equal(safeName.status, 200);
      t.equal(unsafeName.status, 200);
      t.match(stdout, /Starting agent/);
      t.match(stdout, /Zen has detected a JavaScript injection/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
