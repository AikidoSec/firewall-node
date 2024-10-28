const t = require("tap");
const { spawnSync, spawn, execSync } = require("child_process");
const { resolve, join } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(__dirname, "../../sample-apps/strapi");

t.before(() => {
  const { stdout, status } = spawnSync(`npm`, ["run", "build"], {
    cwd: pathToApp,
  });

  if (status !== 0) {
    throw new Error(`Failed to build: ${stdout.toString()}`);
  }
});

// koa/router relies on `Object.create(...)` in the implementation of `router.use`
// We initially wrapped the Router class by hooking into the constructor
// This results in weird behaviour where the router returns 405 for all requests
t.test("it does not return 405 for register admin", (t) => {
  const server = spawn(`node_modules/.bin/strapi`, ["start"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "true",
      NODE_OPTIONS: "-r @aikidosec/firewall",
    },
    cwd: join(pathToApp),
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
  timeout(5000)
    .then((a) => {
      return Promise.all([
        fetch("http://127.0.0.1:1337/admin/register-admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([registerAdmin]) => {
      t.equal(registerAdmin.status, 400);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
