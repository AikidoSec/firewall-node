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

  // Apply rate limiting
  const updateConfigResponse = await fetch(
    `${testServerUrl}/api/runtime/firewall/lists`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        blockedIPAddresses: ["1.3.2.0/24", "fe80::1234:5678:abcd:ef12/64"],
      }),
    }
  );
  t.same(updateConfigResponse.status, 200);
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
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
