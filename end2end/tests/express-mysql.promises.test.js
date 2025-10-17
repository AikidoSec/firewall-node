const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const { readFileSync, writeFileSync } = require("fs");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mysql",
  "app.js"
);

const testServerUrl = "http://localhost:5874";

const buildPackageJsonPath = resolve(__dirname, "../../build/package.json");
let originalPackageJson;

// Temporarily add the internal export before all tests
t.before(() => {
  originalPackageJson = readFileSync(buildPackageJsonPath, "utf8");
  const packageJson = JSON.parse(originalPackageJson);
  packageJson.exports["./agent/AgentSingleton"] = "./agent/AgentSingleton.js";
  writeFileSync(buildPackageJsonPath, JSON.stringify(packageJson, null, 2));
});

// Restore the original package.json after all tests
t.after(() => {
  if (originalPackageJson) {
    writeFileSync(buildPackageJsonPath, originalPackageJson);
  }
});

let token;
t.beforeEach(async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      failureRate: 0.3,
      timeout: 2000,
    }),
  });
  const body = await response.json();
  token = body.token;
});

t.test("pending promises are cleaned up even when API fails", (t) => {
  const server = spawn(`node`, [pathToApp, "4004"], {
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
      const attackPromises = [];
      for (let i = 0; i < 50; i++) {
        attackPromises.push(
          fetch(
            `http://localhost:4004/?petname=${encodeURIComponent(`Kitty'); DELETE FROM cats;-- ${i}`)}`,
            { signal: AbortSignal.timeout(5000) }
          ).catch(() => {
            // Ignore network errors during stress test
          })
        );
      }

      return Promise.all(attackPromises);
    })
    .then(() => {
      return timeout(3000);
    })
    .then(() => {
      return fetch("http://localhost:4004/pending-events", {
        signal: AbortSignal.timeout(5000),
      });
    })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      t.equal(data.pendingCount, 0);
      t.match(stdout, /Starting agent/);
    })
    .catch((error) => {
      t.error(error);
    })
    .finally(() => {
      server.kill();
    });
});
