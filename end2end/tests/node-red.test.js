const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(__dirname, "../../sample-apps/node-red");

t.test("it serves debug script", (t) => {
  const server = spawn(`node_modules/.bin/node-red`, {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "true",
      NODE_OPTIONS: "-r @aikidosec/firewall",
    },
    cwd: pathToApp,
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
  timeout(5000)
    .then(() => {
      return Promise.all([
        fetch(`http://127.0.0.1:1880/debug/view/debug-utils.js`, {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([script]) => {
      t.equal(script.status, 200);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
