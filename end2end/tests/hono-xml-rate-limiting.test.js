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
    `${testServerUrl}/api/runtime/config`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        endpoints: [
          {
            route: "/add",
            method: "POST",
            forceProtectionOff: false,
            rateLimiting: {
              enabled: true,
              maxRequests: 1,
              windowSizeInMS: 60 * 1000,
            },
          },
        ],
      }),
    }
  );
  t.same(updateConfigResponse.status, 200);
});

t.test("it rate limits requests", (t) => {
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, "4002"], {
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
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp1.status, 200);

      const resp2 = await fetch("http://127.0.0.1:4002/add", {
        method: "POST",
        body: "<cat><name>Harry</name></cat>",
        headers: {
          "Content-Type": "application/xml",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp2.status, 429);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("user rate limiting works", (t) => {
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, "4003"], {
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
      const resp1 = await fetch("http://127.0.0.1:4003/add", {
        method: "POST",
        body: "<cat><name>Njuska</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-User-Id": "user1",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp1.status, 200);

      const resp2 = await fetch("http://127.0.0.1:4003/add", {
        method: "POST",
        body: "<cat><name>Harry</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-User-Id": "user2",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp2.status, 200);

      const resp3 = await fetch("http://127.0.0.1:4003/add", {
        method: "POST",
        body: "<cat><name>Njuska</name></cat>",
        headers: {
          "Content-Type": "application/xml",
          "X-User-Id": "user1",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp3.status, 429);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
