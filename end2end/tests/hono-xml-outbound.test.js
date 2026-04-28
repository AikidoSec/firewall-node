const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(__dirname, "../../sample-apps/hono-xml", "app.js");
const testServerUrl = "http://localhost:5874";

const blockedUrl = "https://ssrf-redirects.testssandbox.com/";
const allowedUrl = "https://aikido.dev/";
const unknownUrl = "https://google.com/";

let token;

t.test("blockNewOutgoingRequests is false", (t) => {
  fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  })
    .then((response) => response.json())
    .then((body) => {
      token = body.token;

      return fetch(`${testServerUrl}/api/runtime/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          allowedIPAddresses: ["1.2.3.4"],
          blockNewOutgoingRequests: false,
          domains: [
            { hostname: "ssrf-redirects.testssandbox.com", mode: "block" },
            { hostname: "aikido.dev", mode: "allow" },
            // Otherwise we cannot communicate with the mock server
            { hostname: "localhost", mode: "allow" },
          ],
        }),
      });
    })
    .then((config) => {
      t.same(config.status, 200);

      const server = spawn(`node`, [pathToApp, "4010"], {
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

      let stderr = "";
      server.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      timeout(2000)
        .then(async () => {
          // Blocks request to blocked domain
          const blocked = await fetch(
            `http://127.0.0.1:4010/fetch?url=${encodeURIComponent(blockedUrl)}`,
            { signal: AbortSignal.timeout(5000) }
          );
          t.same(blocked.status, 500);
          t.match(stderr, /Zen has blocked an outbound connection/);

          // Allows request to allowed domain
          const allowed = await fetch(
            `http://127.0.0.1:4010/fetch?url=${encodeURIComponent(allowedUrl)}`,
            { signal: AbortSignal.timeout(5000) }
          );
          t.same(allowed.status, 200);
          t.same((await allowed.json()).success, true);

          // Allows request to unknown domain
          const unknown = await fetch(
            `http://127.0.0.1:4010/fetch?url=${encodeURIComponent(unknownUrl)}`,
            { signal: AbortSignal.timeout(5000) }
          );
          t.same(unknown.status, 200);
          t.same((await unknown.json()).success, true);

          // Allows blocked domain from bypass IP
          stderr = "";
          const bypass = await fetch(
            `http://127.0.0.1:4010/fetch?url=${encodeURIComponent(blockedUrl)}`,
            {
              headers: { "X-Forwarded-For": "1.2.3.4" },
              signal: AbortSignal.timeout(5000),
            }
          );
          t.same(bypass.status, 200);
          t.same((await bypass.json()).success, true);
        })
        .catch((error) => {
          t.fail(error);
        })
        .finally(() => {
          server.kill();
        });
    });
});

t.test("blockNewOutgoingRequests is true", (t) => {
  fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  })
    .then((response) => response.json())
    .then((body) => {
      token = body.token;

      return fetch(`${testServerUrl}/api/runtime/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          allowedIPAddresses: ["1.2.3.4"],
          blockNewOutgoingRequests: true,
          domains: [
            { hostname: "ssrf-redirects.testssandbox.com", mode: "block" },
            { hostname: "aikido.dev", mode: "allow" },
          ],
        }),
      });
    })
    .then((config) => {
      t.same(config.status, 200);

      const server = spawn(`node`, [pathToApp, "4020"], {
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

      let stderr = "";
      server.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      timeout(2000)
        .then(async () => {
          // Blocks request to blocked domain
          const blocked = await fetch(
            `http://127.0.0.1:4020/fetch?url=${encodeURIComponent(blockedUrl)}`,
            { signal: AbortSignal.timeout(5000) }
          );
          t.same(blocked.status, 500);
          t.match(stderr, /Zen has blocked an outbound connection/);

          // Allows request to allowed domain
          const allowed = await fetch(
            `http://127.0.0.1:4020/fetch?url=${encodeURIComponent(allowedUrl)}`,
            { signal: AbortSignal.timeout(5000) }
          );
          t.same(allowed.status, 200);
          t.same((await allowed.json()).success, true);

          // Blocks request to unknown domain
          stderr = "";
          const unknown = await fetch(
            `http://127.0.0.1:4020/fetch?url=${encodeURIComponent(unknownUrl)}`,
            { signal: AbortSignal.timeout(5000) }
          );
          t.same(unknown.status, 500);
          t.match(stderr, /Zen has blocked an outbound connection/);

          // Allows unknown domain from bypass IP
          stderr = "";
          const bypass = await fetch(
            `http://127.0.0.1:4020/fetch?url=${encodeURIComponent(unknownUrl)}`,
            {
              headers: { "X-Forwarded-For": "1.2.3.4" },
              signal: AbortSignal.timeout(5000),
            }
          );
          t.same(bypass.status, 200);
          t.same((await bypass.json()).success, true);
        })
        .catch((error) => {
          t.fail(error);
        })
        .finally(() => {
          server.kill();
        });
    });
});
