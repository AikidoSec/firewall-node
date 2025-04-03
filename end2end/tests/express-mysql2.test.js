const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mysql2",
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
        fetch(
          `http://localhost:4000/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(
          `http://localhost:4000/cats/${encodeURIComponent("Njuska'; DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch("http://localhost:4000/?petname=Njuska", {
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
      t.fail(error.message);
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
        fetch(
          `http://localhost:4001/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(
          `http://localhost:4001/cats/${encodeURIComponent("Njuska'; DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch("http://localhost:4001/?petname=Njuska", {
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
      t.notMatch(
        stderr,
        /Some packages can't be protected because they were imported before Aikido was initialized\. Please make sure to import Aikido as the first module in your application\./
      );
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it prints wrong import warning", (t) => {
  const server = spawn(`node`, [pathToApp, "4002"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "true",
      TEST_IMPORT_TOO_LATE: "true",
    },
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
        fetch(
          `http://localhost:4002/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(
          `http://localhost:4002/cats/${encodeURIComponent("Njuska'; DELETE FROM cats;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch("http://localhost:4002/?petname=Njuska", {
          signal: AbortSignal.timeout(5000),
        }),
      ])
    )
    .then(([sqlInjection, sqlInjection2, normalSearch]) => {
      t.equal(sqlInjection.status, 200);
      t.equal(sqlInjection2.status, 200);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.match(
        stderr,
        /Some packages can't be protected because they were imported before Aikido was initialized\. Please make sure to import Aikido as the first module in your application\./
      );
      t.notMatch(stderr, /Zen has blocked an SQL injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
