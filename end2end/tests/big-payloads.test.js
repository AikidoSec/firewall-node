const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");
const { PromisePool } = require("@supercharge/promise-pool");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mongodb",
  "app.js"
);

t.test("it does not crash if many attacks with big payloads", (t) => {
  const server = spawn(`node`, [pathToApp, "4000"]);

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

  const amount = 2000;

  // Wait for the server to start
  timeout(2000)
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

          return await fetch(`http://localhost:4000/search`, {
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
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
