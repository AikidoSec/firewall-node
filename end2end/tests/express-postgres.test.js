const t = require("tap");
const { spawn, spawnSync } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const directory = resolve(__dirname, "../../sample-apps/express-postgres");

const entrypoints = ["app.js", "compiled.js"];

t.before(() => {
  const { stderr } = spawnSync("node", ["esbuild.js"], {
    cwd: directory,
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
});

entrypoints.forEach((entrypoint) => {
  t.test(`it blocks in blocking mode (${entrypoint})`, (t) => {
    const server = spawn(`node`, [entrypoint, "4000"], {
      env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
      cwd: directory,
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
          fetch(
            `http://localhost:4000/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats_2;-- H")}`,
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
          fetch(
            `http://localhost:4000/string-concat?petname='&petname=1)&petname=(0,1)&petname=(1&petname='`,
            {
              signal: AbortSignal.timeout(5000),
            }
          ),
          fetch("http://localhost:4000/?petname=Njuska", {
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

  t.test(`it does not block in dry mode (${entrypoint})`, (t) => {
    const server = spawn(`node`, [entrypoint, "4001"], {
      env: { ...process.env, AIKIDO_DEBUG: "true" },
      cwd: directory,
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
      .then(() =>
        Promise.all([
          fetch(
            `http://localhost:4001/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats_2;-- H")}`,
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
          fetch(
            `http://localhost:4001/string-concat?petname='&petname=1)&petname=(0,1)&petname=(1&petname='`,
            {
              signal: AbortSignal.timeout(5000),
            }
          ),
          fetch("http://localhost:4001/?petname=Njuska", {
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
});

t.test("it blocks in blocking mode (with dd-trace)", (t) => {
  const server = spawn(
    `node`,
    ["--require", "dd-trace/init", "app.js", "4002"],
    {
      env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
      cwd: directory,
    }
  );

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
          `http://localhost:4002/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats_2;-- H")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(`http://localhost:4002/string-concat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petname: ["'", "1)", "(0,1)", "(1", "'"] }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch(
          `http://localhost:4002/string-concat?petname='&petname=1)&petname=(0,1)&petname=(1&petname='`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch("http://localhost:4002/?petname=Njuska", {
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
