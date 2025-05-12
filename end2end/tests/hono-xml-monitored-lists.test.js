const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(__dirname, "../../sample-apps/hono-xml", "app.js");
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
      blockedIPAddresses: [],
      monitoredIPAddresses: ["1.3.2.0/24", "e98c:a7ba:2329:8c69::/64"],
      monitoredUserAgents: "suspicious-bot|monitored-crawler|GPTBot",
      userAgentDetails: [
        {
          key: "suspicious-bot",
          pattern: "suspicious-bot",
        },
        {
          key: "monitored-crawler",
          pattern: "monitored-crawler",
        },
        {
          key: "gpt-bot",
          pattern: "GPTBot",
        },
      ],
    }),
  });
  t.same(lists.status, 200);
});

t.test("it does not block monitored IPs", (t) => {
  const server = spawn(`node`, [pathToApp, "4005"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_ENDPOINT: testServerUrl,
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
      // Test IPv4 monitoring
      const resp1 = await fetch("http://127.0.0.1:4005/add", {
        method: "POST",
        body: "<cat><name>Njuska</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-Forwarded-For": "1.3.2.4",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp1.status, 200);
      t.same(await resp1.text(), JSON.stringify({ success: true }));

      // Test IPv6 monitoring
      const resp2 = await fetch("http://127.0.0.1:4005/add", {
        method: "POST",
        body: "<cat><name>Harry</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-Forwarded-For": "e98c:a7ba:2329:8c69:a13a:8aff:a932:13f2",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp2.status, 200);
      t.same(await resp2.text(), JSON.stringify({ success: true }));
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block monitored user agents", (t) => {
  const server = spawn(`node`, [pathToApp, "4006"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_ENDPOINT: testServerUrl,
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
      // Test monitored user agent
      const resp1 = await fetch("http://127.0.0.1:4006/", {
        headers: {
          "User-Agent": "suspicious-bot",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp1.status, 200);

      // Test monitored GPT bot
      const resp2 = await fetch("http://127.0.0.1:4006/", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp2.status, 200);

      // Test monitored crawler
      const resp3 = await fetch("http://127.0.0.1:4006/", {
        headers: {
          "User-Agent": "monitored-crawler/1.0",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp3.status, 200);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
