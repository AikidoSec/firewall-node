const t = require("tap");
const { spawnSync, spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(__dirname, "../../sample-apps/nestjs-fastify");

t.before(() => {
  const { stderr } = spawnSync(`npm`, ["run", "build"], {
    cwd: pathToApp,
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
});

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, ["dist/main"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      PORT: "4000",
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
  timeout(5000)
    .then(() => {
      return Promise.all([
        fetch("http://127.0.0.1:4000/cats", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Test'), ('Test2');--" }),
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(async ([sqlInjectionReq]) => {
      t.equal(sqlInjectionReq.status, 500);

      // For some reason nestjs doesn't log the error immediately
      await new Promise((resolve) => setTimeout(resolve, 1000));

      t.match(stdout, /Starting agent/);
      t.match(stderr, /Zen has blocked an SQL injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in non-blocking mode", (t) => {
  const server = spawn(`node`, ["dist/main"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "false",
      PORT: "4001",
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
  timeout(5000)
    .then(() => {
      return Promise.all([
        fetch("http://127.0.0.1:4001/cats", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Test'), ('Test2');--" }),
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(async ([sqlInjectionReq]) => {
      t.equal(sqlInjectionReq.status, 201);

      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Zen has blocked an SQL injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
