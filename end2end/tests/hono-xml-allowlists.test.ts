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
      allowedIPAddresses: ["5.6.7.8", "10.0.0.1/16"],
      endpoints: [
        {
          route: "/admin",
          method: "GET",
          forceProtectionOff: false,
          allowedIPAddresses: ["10.0.0.1/16"],
          rateLimiting: {
            enabled: false,
          },
        },
        {
          route: "/admin/*",
          method: "GET",
          forceProtectionOff: false,
          allowedIPAddresses: ["10.0.0.1/16"],
          rateLimiting: {
            enabled: false,
          },
        },
        {
          route: "/admin/public",
          method: "GET",
          forceProtectionOff: false,
          allowedIPAddresses: ["0.0.0.0/0", "::/0"],
          rateLimiting: {
            enabled: false,
          },
        },
      ],
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
      allowedIPAddresses: ["4.3.2.1/32", "fe80::1234:5678:abcd:ef12/64"],
      blockedIPAddresses: [],
      blockedUserAgents: "hacker|attacker|GPTBot",
    }),
  });
  t.same(lists.status, 200);
});

t.test("it blocks non-allowed IP addresses", (t) => {
  const server = spawn(`node`, [pathToApp, "4002"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "true",
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
        "Your IP address is not allowed to access this resource. (Your IP: 1.3.2.4)"
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
      t.same(resp2.status, 200);
      t.same(await resp2.text(), JSON.stringify({ success: true }));

      const resp3 = await fetch("http://127.0.0.1:4002/add", {
        method: "POST",
        body: "<cat><name>Harry</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-Forwarded-For": "4.3.2.1",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp3.status, 200);
      t.same(await resp3.text(), JSON.stringify({ success: true }));

      const resp4 = await fetch("http://127.0.0.1:4002/add", {
        method: "POST",
        body: "<cat><name>Harry2</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-Forwarded-For": "5.6.7.8",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp4.status, 200);
      t.same(await resp4.text(), JSON.stringify({ success: true }));

      const resp5 = await fetch("http://127.0.0.1:4002/admin", {
        headers: {
          "X-Forwarded-For": "10.0.0.2",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp5.status, 200);

      const resp6 = await fetch("http://127.0.0.1:4002/admin", {
        headers: {
          "X-Forwarded-For": "5.6.7.8",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp6.status, 403);

      const resp7 = await fetch("http://127.0.0.1:4002/admin/public", {
        headers: {
          "X-Forwarded-For": "5.6.7.8",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp7.status, 200);

      const resp8 = await fetch("http://127.0.0.1:4002/admin/private", {
        headers: {
          "X-Forwarded-For": "5.6.7.8",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp8.status, 403);

      // IPv4-mapped IPv6 address should also be allowed (matches 4.3.2.1/32)
      const resp9 = await fetch("http://127.0.0.1:4002/add", {
        method: "POST",
        body: "<cat><name>Mapped</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-Forwarded-For": "::ffff:4.3.2.1",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp9.status, 200);
      t.same(await resp9.text(), JSON.stringify({ success: true }));
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
