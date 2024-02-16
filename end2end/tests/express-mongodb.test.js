const t = require("tap");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mongodb",
  "app.js"
);

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp], { shell: true });

  let stdout = "";
  server.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  server.unref();

  setTimeout(() => {
    Promise.all([
      fetch("http://localhost:4000/?search[$ne]=null", {
        signal: AbortSignal.timeout(5000),
      }),
      fetch("http://localhost:4000/?search=title", {
        signal: AbortSignal.timeout(5000),
      }),
    ])
      .then((results) => {
        const [noSQLInjection, normalSearch] = results;
        t.equal(noSQLInjection.status, 500);
        t.equal(normalSearch.status, 200);
        t.match(stdout, /Starting agent/);
        t.match(stderr, /Aikido guard has blocked a NoSQL injection/);
      })
      .catch((error) => {
        t.fail(error.message);
      })
      .finally(() => {
        server.kill();
        t.end();
      });
  }, 1000);
});

t.test("it does not block in dry mode", (t) => {
  const server = spawn(`node`, [pathToApp], {
    env: { ...process.env, AIKIDO_NO_BLOCKING: "true" },
    shell: true,
  });

  let stdout = "";
  server.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  server.unref();

  setTimeout(() => {
    Promise.all([
      fetch("http://localhost:4000/?search[$ne]=null", {
        signal: AbortSignal.timeout(5000),
      }),
      fetch("http://localhost:4000/?search=title", {
        signal: AbortSignal.timeout(5000),
      }),
    ])
      .then((results) => {
        const [noSQLInjection, normalSearch] = results;
        t.equal(noSQLInjection.status, 200);
        t.equal(normalSearch.status, 200);
        t.match(stdout, /Starting agent/);
        t.notMatch(stderr, /Aikido guard has blocked a NoSQL injection/);
      })
      .catch((error) => {
        t.fail(error.message);
      })
      .finally(() => {
        server.kill();
        t.end();
      });
  }, 1000);
});
