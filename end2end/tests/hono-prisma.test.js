const t = require("tap");
const { spawn } = require("child_process");
const { resolve, join } = require("path");
const timeout = require("../timeout");
const { promisify } = require("util");
const { exec: execCb } = require("child_process");

const execAsync = promisify(execCb);

const appDir = resolve(__dirname, "../../sample-apps/hono-prisma");
const pathToApp = join(appDir, "app.js");

t.before(async (t) => {
  // Generate prismajs client
  const { stdout, stderr } = await execAsync(
    "npx prisma migrate reset --force", // Generate prisma client, reset db and apply migrations
    {
      cwd: appDir,
    }
  );

  if (stderr) {
    t.fail(stderr);
  }
});

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4002"], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
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
    .then(() => {
      return Promise.all([
        fetch('http://127.0.0.1:4002/posts/Test" OR 1=1 -- C', {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://127.0.0.1:4002/posts/Happy", {
          method: "GET",
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
});

t.test("it does not block in non-blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4002"], {
    env: { ...process.env, AIKIDO_DEBUG: "true" },
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
    .then(() => {
      return Promise.all([
        fetch('http://127.0.0.1:4002/posts/Test" OR 1=1 -- C', {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://127.0.0.1:4002/posts/Happy", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([sqlInjection, normalAdd]) => {
      t.equal(sqlInjection.status, 200);
      t.equal(normalAdd.status, 200);
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
