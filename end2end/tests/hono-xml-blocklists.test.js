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

  const config = await fetch(`${testServerUrl}/api/runtime/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      allowedIPAddresses: ["1.3.2.1"],
    }),
  });
  t.same(config.status, 200);

  const lists = await fetch(`${testServerUrl}/api/runtime/firewall/lists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      blockedIPAddresses: ["1.3.2.0/24", "fe80::1234:5678:abcd:ef12/64"],
      blockedUserAgents: "hacker|attacker|GPTBot",
    }),
  });
  t.same(lists.status, 200);
});

t.test("it blocks geo restricted IPs", (t) => {
  const server = spawn(`node`, [pathToApp, "4002"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_URL: testServerUrl,
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
      const resp1 = await fetch("http://127.0.0.1:4002/add", {
        method: "POST",
        body: "<cat><name>Njuska</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-Forwarded-For": "1.3.2.4",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp1.status, 403);
      t.same(
        await resp1.text(),
        "Your IP address is blocked due to geo restrictions. (Your IP: 1.3.2.4)"
      );

      const resp2 = await fetch("http://127.0.0.1:4002/add", {
        method: "POST",
        body: "<cat><name>Harry</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-Forwarded-For": "fe80::1234:5678:abcd:ef12",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp2.status, 403);
      t.same(
        await resp2.text(),
        "Your IP address is blocked due to geo restrictions. (Your IP: fe80::1234:5678:abcd:ef12)"
      );

      const resp3 = await fetch("http://127.0.0.1:4002/add", {
        method: "POST",
        body: "<cat><name>Harry</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-Forwarded-For": "9.8.7.6",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp3.status, 200);
      t.same(await resp3.text(), JSON.stringify({ success: true }));
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it blocks bots", (t) => {
  const server = spawn(`node`, [pathToApp, "4003"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_URL: testServerUrl,
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
      const resp1 = await fetch("http://127.0.0.1:4003/", {
        headers: {
          "User-Agent": "hacker",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp1.status, 403);
      t.same(
        await resp1.text(),
        "You are not allowed to access this resource because you have been identified as a bot."
      );

      // Block GPT bot
      const resp2 = await fetch("http://127.0.0.1:4003/", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp2.status, 403);
      t.same(
        await resp2.text(),
        "You are not allowed to access this resource because you have been identified as a bot."
      );

      // Does not block allowed user agents
      const allowedUserAgents = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.200 Mobile Safari/537.36",
      ];
      for (const userAgent of allowedUserAgents) {
        const resp = await fetch("http://127.0.0.1:4003/", {
          headers: {
            "User-Agent": userAgent,
          },
          signal: AbortSignal.timeout(5000),
        });
        t.same(resp.status, 200);
      }
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block bypass IP if in blocklist", (t) => {
  const server = spawn(`node`, [pathToApp, "4004"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_URL: testServerUrl,
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
      const resp1 = await fetch("http://127.0.0.1:4004/", {
        headers: {
          "X-Forwarded-For": "1.3.2.1",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp1.status, 200);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
