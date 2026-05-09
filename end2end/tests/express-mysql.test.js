const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mysql",
  "app.js"
);

const testServerUrl = "http://localhost:5874";

let token;
t.beforeEach(async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  token = body.token;
});

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
        fetch("http://localhost:4000/cats", {
          signal: AbortSignal.timeout(5000),
          method: "POST",
          body: "<cat><name>Njuska'); DELETE FROM cats;-- H</name></cat>",
          headers: {
            "Content-Type": "application/xml",
          },
        }),
        fetch("http://localhost:4000/?petname=Njuska", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://localhost:4000/cats", {
          signal: AbortSignal.timeout(5000),
          method: "POST",
          body: "<cat><name>Njuska</name></cat>",
          headers: {
            "Content-Type": "application/xml",
          },
        }),
      ]);
    })
    .then(([noSQLInjection, noSQLInjectionXml, normalSearch, normalAddXml]) => {
      t.equal(noSQLInjection.status, 500);
      t.equal(noSQLInjectionXml.status, 500);
      t.equal(normalSearch.status, 200);
      t.equal(normalAddXml.status, 200);
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
        fetch("http://localhost:4001/cats", {
          signal: AbortSignal.timeout(5000),
          method: "POST",
          body: "<cat><name>Njuska'); DELETE FROM cats;-- H</name></cat>",
          headers: {
            "Content-Type": "application/xml",
          },
        }),
        fetch("http://localhost:4001/?petname=Njuska", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://localhost:4001/cats", {
          signal: AbortSignal.timeout(5000),
          method: "POST",
          body: "<cat><name>Njuska</name></cat>",
          headers: {
            "Content-Type": "application/xml",
          },
        }),
      ])
    )
    .then(([noSQLInjection, noSQLInjectionXml, normalSearch, normalAddXml]) => {
      t.equal(noSQLInjection.status, 200);
      t.equal(noSQLInjectionXml.status, 200);
      t.equal(normalSearch.status, 200);
      t.equal(normalAddXml.status, 200);
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

t.test("it does not block invalid SQL queries by default", (t) => {
  const server = spawn(`node`, [pathToApp, "4003"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
    },
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
      return fetch(
        `http://localhost:4003/invalid-query?sql=${encodeURIComponent("SELECT * FROM test")}`,
        {
          signal: AbortSignal.timeout(5000),
          method: "POST",
        }
      );
    })
    .then((response) => {
      t.equal(response.status, 500);
      t.notMatch(stdout, /Zen has blocked an SQL injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test(
  "it blocks invalid SQL queries when AIKIDO_BLOCK_INVALID_SQL is true",
  (t) => {
    const server = spawn(`node`, [pathToApp, "4004"], {
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCKING: "true",
        AIKIDO_BLOCK_INVALID_SQL: "true",
      },
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
        return fetch(
          `http://localhost:4004/invalid-query?sql=${encodeURIComponent("I'm a test")}`,
          {
            signal: AbortSignal.timeout(5000),
            method: "POST",
          }
        );
      })
      .then((response) => {
        t.equal(response.status, 500);
        t.match(stdout, /Zen has blocked an SQL injection/);
      })
      .catch((error) => {
        t.fail(error.message);
      })
      .finally(() => {
        server.kill();
      });
  }
);
