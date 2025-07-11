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

t.setTimeout(80000);

t.test(
  "it increments sqlTokenizationFailures counter for invalid SQL queries",
  (t) => {
    const server = spawn(`node`, [pathToApp, "4003"], {
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCKING: "true",
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
      },
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
        return fetch(
          `http://localhost:4003/invalid-query?sql=${encodeURIComponent("SELECT * FROM test")}`,
          {
            signal: AbortSignal.timeout(5000),
            method: "POST",
          }
        );
      })
      .then((response) => {
        return response.text();
      })
      .then((responseText) => {
        t.match(responseText, /You have an error in your SQL syntax/);

        // Wait for the heartbeat event to be sent
        return timeout(60000);
      })
      .then(() => {
        return fetch(`${testServerUrl}/api/runtime/events`, {
          method: "GET",
          headers: {
            Authorization: token,
          },
          signal: AbortSignal.timeout(5000),
        });
      })
      .then((response) => {
        return response.json();
      })
      .then((events) => {
        const heartbeatEvents = events.filter(
          (event) => event.type === "heartbeat"
        );
        t.same(heartbeatEvents.length, 1);
        const [heartbeat] = heartbeatEvents;
        t.equal(heartbeat.stats.sqlTokenizationFailures, 1);
      })
      .catch((error) => {
        t.error(error);
      })
      .finally(() => {
        server.kill();
      });
  }
);
