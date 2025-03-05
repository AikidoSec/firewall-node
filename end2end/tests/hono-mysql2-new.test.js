const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToAppDir = resolve(__dirname, "../../sample-apps/hono-mysql2-new");

const supported = typeof require("node:module").registerHooks === "function";

t.test(
  "it blocks in blocking mode",
  {
    skip: "See https://github.com/nodejs/node/issues/57327",
  },
  (t) => {
    const server = spawn(`node`, ["--run", "start", "--", "4002"], {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
      },
    });

    server.on("close", () => {
      t.end();
    });

    server.on("error", (err) => {
      console.log(err);
      t.fail(err.message);
    });

    let stdout = "";
    server.stdout.on("data", (data) => {
      console.log(data.toString());
      stdout += data.toString();
    });

    let stderr = "";
    server.stderr.on("data", (data) => {
      console.log(data.toString());
      stderr += data.toString();
    });

    // Wait for the server to start
    timeout(2000)
      .then(() => {
        return Promise.all([
          fetch("http://127.0.0.1:4002/add", {
            method: "POST",
            body: JSON.stringify({ name: "Njuska'); DELETE FROM cats;-- H" }),
            headers: {
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(5000),
          }),
          fetch("http://127.0.0.1:4002/add", {
            method: "POST",
            body: JSON.stringify({ name: "Miau" }),
            headers: {
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(5000),
          }),
        ]);
      })
      .then(([sqlInjection, normalAdd]) => {
        t.equal(sqlInjection.status, 500);
        t.equal(normalAdd.status, 200);
        t.match(stdout, /Starting agent/);
        t.match(stderr, /Zen has blocked an SQL injection/);
      })
      .catch((error) => {
        t.fail(error.message);
      })
      .finally(() => {
        server.kill();
      });
  }
);
