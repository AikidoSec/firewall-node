const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/hono-sqlite3",
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

  const lists = await fetch(`${testServerUrl}/api/runtime/firewall/lists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      allowedIPAddresses: [],
      blockedIPAddresses: [],
      blockedUserAgents: "",
      botSpoofingProtection: [
        {
          key: "google_test",
          uaPattern: "Googlebot|GoogleStoreBot",
          ips: ["1.2.3.4/24", "4.3.2.1"],
          hostnames: ["google.com", "googlebot.com"],
        },
      ],
    }),
  });
  t.same(lists.status, 200);
});

t.test("it blocks spoofed bots", (t) => {
  const server = spawn(`node`, [pathToApp, "4012"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_ENDPOINT: testServerUrl,
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
  timeout(4000)
    .then(async () => {
      {
        const response = await fetch("http://127.0.0.1:4012/", {
          headers: {
            "user-agent": "Googlebot",
            "x-forwarded-for": "1.1.1.1",
          },
          signal: AbortSignal.timeout(5000),
        });
        t.same(response.status, 403);
        t.same(
          await response.text(),
          "You are not allowed to access this resource."
        );
      }
      {
        const response = await fetch("http://127.0.0.1:4012/", {
          headers: {
            "user-agent": "Googlebot",
            "x-forwarded-for": "127.0.0.1",
          },
          signal: AbortSignal.timeout(5000),
        });
        t.same(response.status, 200); // localhost is not blocked
      }
      {
        const response = await fetch("http://127.0.0.1:4012/", {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15",
            "x-forwarded-for": "1.1.1.1",
          },
          signal: AbortSignal.timeout(5000),
        });
        t.same(response.status, 200); // not a protected bot
      }
      {
        const response = await fetch("http://127.0.0.1:4012/", {
          headers: {
            "user-agent": "Googlebot",
            "x-forwarded-for": "66.249.90.77",
          },
          signal: AbortSignal.timeout(5000),
        });
        t.same(response.status, 200); // Real Googlebot ip
      }
      {
        const response = await fetch("http://127.0.0.1:4012/", {
          headers: {
            "user-agent": "Googlebot",
            "x-forwarded-for": "1.2.3.4",
          },
          signal: AbortSignal.timeout(5000),
        });
        t.same(response.status, 200); // whitelisted ip
      }
      {
        const response = await fetch("http://127.0.0.1:4012/", {
          headers: {
            "user-agent": "Googlebot",
            "x-forwarded-for": "4.3.2.1",
          },
          signal: AbortSignal.timeout(5000),
        });
        t.same(response.status, 200); // whitelisted ip
      }
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
