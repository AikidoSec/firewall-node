const t = require("tap");
const { spawn } = require("child_process");
const { resolve, join } = require("path");
const timeout = require("../timeout");

const appDir = resolve(__dirname, "../../sample-apps/micro");
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
            route: "/",
            method: "GET",
            forceProtectionOff: false,
            rateLimiting: {
              enabled: true,
              maxRequests: 3,
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
  const server = spawn(
    `node`,
    [
      "--preserve-symlinks", // isMicroInstalled will not work otherwise
      "-r",
      "@aikidosec/firewall",
      join(appDir, "node_modules/.bin/micro"),
      "-l",
      "tcp://127.0.0.1:4000",
    ],
    {
      cwd: appDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        AIKIDO_TOKEN: token,
        AIKIDO_ENDPOINT: testServerUrl,
        AIKIDO_REALTIME_ENDPOINT: testServerUrl,
      },
    }
  );

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
      for (let i = 0; i < 3; i++) {
        const resp = await fetch("http://127.0.0.1:4000/", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        t.same(resp.status, 200);
      }

      const respRateLimited = await fetch("http://127.0.0.1:4000/", {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      t.same(respRateLimited.status, 429);

      const ssrfResponse = await fetch("http://127.0.0.1:4000/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "http://172.17.0.1:2375/containers/json",
        }),
        signal: AbortSignal.timeout(5000),
      });
      t.same(ssrfResponse.status, 500);
      t.match(stdout, /Zen has blocked a server-side request forgery/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
