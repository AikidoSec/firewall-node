const t = require("tap");
const { spawn } = require("child_process");
const { resolve, join } = require("path");
const timeout = require("../timeout");

const appDir = resolve(__dirname, "../../sample-apps/express5-esm");
const pathToApp = join(appDir, "app.js");

t.test("it blocks SSRF via fetch in ESM mode", (t) => {
  const server = spawn(
    `node`,
    ["--import", "@aikidosec/firewall/instrument", pathToApp, "4050"],
    {
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCKING: "true",
      },
      cwd: appDir,
    }
  );

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

  timeout(2000)
    .then(() => {
      return Promise.all([
        fetch("http://127.0.0.1:4050/fetch?url=https://aikido.dev", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(
          `http://127.0.0.1:4050/fetch?url=${encodeURIComponent("http://127.0.0.1:4321")}`,
          { signal: AbortSignal.timeout(5000) }
        ),
      ]);
    })
    .then(([safeRequest, ssrfRequest]) => {
      t.equal(safeRequest.status, 200);
      t.equal(ssrfRequest.status, 500);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Zen has blocked a server-side request forgery/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it blocks SSRF via http.request in ESM mode", (t) => {
  const server = spawn(
    `node`,
    ["--import", "@aikidosec/firewall/instrument", pathToApp, "4051"],
    {
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCKING: "true",
      },
      cwd: appDir,
    }
  );

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

  timeout(2000)
    .then(() => {
      return Promise.all([
        fetch("http://127.0.0.1:4051/http-request?url=https://aikido.dev", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(
          `http://127.0.0.1:4051/http-request?url=${encodeURIComponent("http://127.0.0.1:4321")}`,
          { signal: AbortSignal.timeout(5000) }
        ),
      ]);
    })
    .then(([safeRequest, ssrfRequest]) => {
      t.equal(safeRequest.status, 200);
      t.equal(ssrfRequest.status, 500);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Zen has blocked a server-side request forgery/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
