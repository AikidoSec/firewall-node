const t = require("tap");
const { spawn, execSync } = require("child_process");
const { resolve, join } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(__dirname, "../../sample-apps/n8n");
const dataFolder = join(pathToApp, ".n8n");

t.before(() => {
  // Delete the .n8n folder if it exists
  try {
    execSync(`rm -rf ${dataFolder}`);
  } catch (error) {
    // Ignore error
  }
});

const majorNodeVersion = parseInt(process.version.split(".")[0].slice(1), 10);

t.test(
  "it logs in",
  {
    skip:
      majorNodeVersion > 22 ? "n8n does not support Node.js v23 yet" : false,
  },
  (t) => {
    const port = 5678;
    const server = spawn(`node_modules/.bin/n8n`, {
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
        NODE_OPTIONS: "-r @aikidosec/firewall",
        N8N_PORT: port.toString(),
        N8N_USER_FOLDER: dataFolder,
      },
      cwd: pathToApp,
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
    timeout(8000)
      .then(() => {
        return fetch(`http://127.0.0.1:${port}/rest/owner/setup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agree: true,
            email: "john.doe@acme.com",
            firstName: "John",
            lastName: "Doe",
            password: "Password1234!",
          }),
          signal: AbortSignal.timeout(5000),
        });
      })
      .then((registerAdmin) => {
        t.equal(registerAdmin.status, 200);
        const setCookie = registerAdmin.headers.get("Set-Cookie").split(";")[0];
        t.ok(setCookie.includes("n8n-auth"));

        return setCookie;
      })
      .then((cookie) => {
        return Promise.all([
          fetch(`http://127.0.0.1:${port}/home/workflows`, {
            headers: {
              Cookie: cookie,
            },
            signal: AbortSignal.timeout(5000),
          }),
          fetch(`http://127.0.0.1:${port}/rest/workflows`, {
            headers: {
              Cookie: cookie,
            },
            signal: AbortSignal.timeout(5000),
          }),
        ]);
      })
      .then(([workflows, restWorkflows]) => {
        t.equal(workflows.status, 200);
        t.equal(restWorkflows.status, 200);
      })
      .catch((error) => {
        t.fail(error.message);
      })
      .finally(() => {
        server.kill();
      });
  }
);
