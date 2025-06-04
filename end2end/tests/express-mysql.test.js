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

t.test("it rate limits failed tokenize SQL attacks", (t) => {
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
      return Promise.all(
        Array.from({
          // After 100 requests, the server should rate limit the attacks being reported
          length: 101,
        }).map((_, i) =>
          fetch(
            // Some user input has to be included in the SQL query to trigger the SQL injection detection
            `http://localhost:4003/invalid-query?sql=${encodeURIComponent("SELECT * FROM test")}`,
            {
              signal: AbortSignal.timeout(5000),
              method: "POST",
              headers: {
                "Content-Type": "application/xml",
              },
            }
          )
        )
      );
    })
    .then((requests) => {
      return Promise.all(requests.map((request) => request.text()));
    })
    .then((requests) => {
      for (const request of requests) {
        // Check that each request contains the SQL syntax error message (And not Zen blocked the request)
        t.match(request, /You have an error in your SQL syntax/);
      }

      return fetch(`${testServerUrl}/api/runtime/events`, {
        method: "GET",
        headers: {
          Authorization: token,
        },
      });
    })
    .then((response) => {
      return response.json();
    })
    .then((events) => {
      const attacks = events.filter(
        (event) => event.type === "detected_attack"
      );
      t.same(attacks.length, 100);
      const [event] = attacks;

      // Even though the server is in blocking mode, the attack should not be blocked
      t.same(event.attack.blocked, false);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
