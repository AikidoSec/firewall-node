const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/hono-sqlite-ai",
  "app.js"
);

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4006"], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCK: "true" },
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
          `http://127.0.0.1:4006/weather?prompt=${encodeURIComponent('What is the weather in "Ghent\'; DELETE FROM weather; --" like?')}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
      ]);
    })
    .then(async ([sqlInjection]) => {
      t.equal(sqlInjection.status, 500);

      const response = await sqlInjection.json();
      t.equal(
        response.error,
        "Error executing tool weather: Zen has blocked an SQL injection: better-sqlite3.prepare(...) originating from aiToolParams.[0].location"
      );
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in monitoring mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4007"], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCK: "false" },
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
          `http://127.0.0.1:4007/weather?prompt=${encodeURIComponent('What is the weather in "Ghent\'; DELETE FROM weather; --" like?')}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
      ]);
    })
    .then(async ([sqlInjection]) => {
      t.equal(sqlInjection.status, 500);

      const response = await sqlInjection.json();
      t.equal(
        response.error,
        "Error executing tool weather: The supplied SQL string contains more than one statement"
      );
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
