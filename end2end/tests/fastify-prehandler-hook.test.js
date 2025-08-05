const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/fastify-prehandler-hook",
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

  const config = await fetch(`${testServerUrl}/api/runtime/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      blockedUserIds: ["blocked_user"],
    }),
  });
  t.same(config.status, 200);
});

t.test("it blocks user when user is in blocked list", (t) => {
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
    .then(async () => {
      // Test blocked user
      const blockedResp = await fetch("http://127.0.0.1:4004/dashboard", {
        headers: {
          Authorization: "blocked_user",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(blockedResp.status, 403);
      t.same(await blockedResp.text(), "You are blocked by Aikido firewall.");

      // Test allowed user
      const allowedResp = await fetch("http://127.0.0.1:4004/dashboard", {
        headers: {
          Authorization: "user123",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(allowedResp.status, 200);
      const allowedBody = await allowedResp.json();
      t.same(allowedBody.message, "Welcome to your dashboard");
      t.same(allowedBody.user.id, "user123");
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
