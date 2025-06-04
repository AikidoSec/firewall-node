const t = require("tap");
const { spawn, spawnSync } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(__dirname, "../../sample-apps/nestjs-fastify");
const testServerUrl = "http://localhost:5874";

t.before(() => {
  const { stderr } = spawnSync(`npm`, ["run", "build"], {
    cwd: pathToApp,
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
});

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
            route: "/cats",
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
  const server = spawn(`node`, ["dist/main"], {
    cwd: pathToApp,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_ENDPOINT: testServerUrl,
      AIKIDO_REALTIME_ENDPOINT: testServerUrl,
      PORT: "4002",
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
      const resp1 = await fetch("http://127.0.0.1:4002/cats", {
        method: "POST",
        body: JSON.stringify({ name: "Njuska" }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp1.status, 201);

      const resp2 = await fetch("http://127.0.0.1:4002/cats", {
        method: "POST",
        body: JSON.stringify({ name: "Harry" }),
        headers: {
          "Content-Type": "application/json",
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
  const server = spawn(`node`, ["dist/main"], {
    cwd: pathToApp,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_ENDPOINT: testServerUrl,
      AIKIDO_REALTIME_ENDPOINT: testServerUrl,
      PORT: "4003",
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
      const resp1 = await fetch("http://127.0.0.1:4003/cats", {
        method: "POST",
        body: JSON.stringify({ name: "Njuska" }),
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "user1",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp1.status, 201);

      const resp2 = await fetch("http://127.0.0.1:4003/cats", {
        method: "POST",
        body: JSON.stringify({ name: "Harry" }),
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "user2",
        },
        signal: AbortSignal.timeout(5000),
      });
      t.same(resp2.status, 201);

      const resp3 = await fetch("http://127.0.0.1:4003/cats", {
        method: "POST",
        body: JSON.stringify({ name: "Harry" }),
        headers: {
          "Content-Type": "application/json",
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
