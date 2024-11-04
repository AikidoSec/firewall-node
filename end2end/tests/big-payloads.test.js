const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const waitOn = require("../waitOn");
const getFreePort = require("../getFreePort");
const { PromisePool } = require("@supercharge/promise-pool");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mongodb",
  "app.js"
);

t.test("it does not crash if many attacks with big payloads", (t) => {
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

  const amount = 2000;

  // Wait for the server to start
  waitOn(port)
    .then(() => {
      return PromisePool.withConcurrency(3)
        .for(Array.from({ length: amount }))
        .process(async () => {
          const filter = {
            $or: Array.from({ length: 100 }).map(() => ({
              $and: Array.from({ length: 100 }).map(() => ({
                title: { $gt: "" },
              })),
            })),
          };

          return await fetch(`http://localhost:${port}/search`, {
            method: "POST",
            signal: AbortSignal.timeout(5000),
            body: JSON.stringify(filter),
          });
        });
    })
    .then(({ results, errors }) => {
      t.same(errors.length, 0);
      t.same(
        results.map((response) => response.status),
        Array.from({ length: amount }).fill(500)
      );
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
