const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mysql",
  "app-set-token.js"
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

t.test(
  "it blocks after setToken is called and sends a heartbeat",
  { timeout: 60000 },
  (t) => {
    const server = spawn(`node`, [pathToApp, "4020"], {
      env: {
        ...process.env,
        AIKIDO_INSTRUMENT: "true",
        TEST_AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
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

    // Wait for server + setToken (500ms delay in app)
    timeout(2000)
      .then(() => {
        return Promise.all([
          fetch(
            `http://localhost:4020/?petname=${encodeURIComponent("Njuska'); DELETE FROM cats;-- H")}`,
            {
              signal: AbortSignal.timeout(5000),
            }
          ),
          fetch("http://localhost:4020/?petname=Njuska", {
            signal: AbortSignal.timeout(5000),
          }),
        ]);
      })
      .then(([sqlInjection, normalSearch]) => {
        t.equal(sqlInjection.status, 500);
        t.equal(normalSearch.status, 200);
        t.match(stdout, /Starting agent/);
        t.match(stderr, /Zen has blocked an SQL injection/);
      })
      .then(() => {
        // Wait for heartbeat (agent sends after ~30s)
        return timeout(31000);
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
      .then((response) => response.json())
      .then((events) => {
        const startedEvents = events.filter((e) => e.type === "started");
        t.equal(startedEvents.length, 1);

        const heartbeatEvents = events.filter((e) => e.type === "heartbeat");
        t.equal(heartbeatEvents.length, 1);
      })
      .catch((error) => {
        t.fail(error.message);
      })
      .finally(() => {
        server.kill();
      });
  }
);
