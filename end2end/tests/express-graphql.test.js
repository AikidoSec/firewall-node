const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-graphql",
  "app.js"
);

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4000"], {
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
        fetch(`http://localhost:4000/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: 'query { cats(name: "1\' OR 1=1; -- ") { petname age } }',
          }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://localhost:4000/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: 'query { cats(name: "Test") { petname age } }',
          }),
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(async ([sqlInjection, normalSearch]) => {
      t.equal(sqlInjection.status, 200);
      t.equal(normalSearch.status, 200);
      const sqlInjectionText = await sqlInjection.text();
      const normalSearchText = await normalSearch.text();
      t.match(sqlInjectionText, /Zen has blocked an SQL injection/);
      t.notMatch(normalSearchText, /Zen has blocked an SQL injection/);
      t.match(stdout, /Starting agent/);
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
    .then(() =>
      Promise.all([
        fetch(`http://localhost:4000/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: 'query { cats(name: "1\' OR 1=1; -- ") { petname age } }',
          }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://localhost:4000/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: 'query { cats(name: "Test") { petname age } }',
          }),
          signal: AbortSignal.timeout(5000),
        }),
      ])
    )
    .then(async ([sqlInjection, normalSearch]) => {
      t.equal(sqlInjection.status, 200);
      t.equal(normalSearch.status, 200);
      const sqlInjectionText = await sqlInjection.text();
      const normalSearchText = await normalSearch.text();
      t.notMatch(sqlInjectionText, /Zen has blocked an SQL injection/);
      t.notMatch(normalSearchText, /Zen has blocked an SQL injection/);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Zen has blocked an SQL injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
