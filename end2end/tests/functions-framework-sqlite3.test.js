const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const appDir = resolve(
  __dirname,
  "../../sample-apps/functions-framework-sqlite3"
);

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(
    `./node_modules/.bin/functions-framework`,
    ["--port", "4010"],
    {
      env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCK: "true" },
      cwd: appDir,
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
    .then(() => {
      return Promise.all([
        fetch("http://127.0.0.1:4010/?petname=Kitty'); DELETE FROM cats;-- H", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://127.0.0.1:4010/?petname=Miau", {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([sqlInjection, normalAdd]) => {
      t.equal(sqlInjection.status, 500);
      t.equal(normalAdd.status, 200);
      t.match(stdout, /Starting agent/);
      t.match(
        stderr,
        /Zen has blocked an SQL injection: better-sqlite3.exec\(\.\.\.\) originating from query\.petname/
      );
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  const server = spawn(
    `./node_modules/.bin/functions-framework`,
    ["--port", "4011"],
    {
      env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCK: "false" },
      cwd: appDir,
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
    .then(() => {
      return Promise.all([
        fetch("http://127.0.0.1:4011/?petname=Kitty'); DELETE FROM cats;-- H", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://127.0.0.1:4011/?petname=Miau", {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([sqlInjection, normalAdd]) => {
      t.equal(sqlInjection.status, 200);
      t.equal(normalAdd.status, 200);
      t.match(stdout, /Starting agent/);
      t.notMatch(
        stderr,
        /Zen has blocked an SQL injection: better-sqlite3.exec\(\.\.\.\) originating from query\.petname/
      );
      t.notMatch(
        stdout,
        /AIKIDO: Zen is disabled\. Configure one of the following environment variables to enable it: AIKIDO_BLOCK, AIKIDO_TOKEN, AIKIDO_DEBUG/
      );
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not enable Zen when no environment variables are set", (t) => {
  const server = spawn(
    `./node_modules/.bin/functions-framework`,
    ["--port", "4012"],
    {
      env: { ...process.env, AIKIDO_CI: false },
      cwd: appDir,
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
    .then(() => {
      return Promise.all([
        fetch("http://127.0.0.1:4012/?petname=Kitty'); DELETE FROM cats;-- H", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://127.0.0.1:4012/?petname=Miau", {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([sqlInjection, normalAdd]) => {
      t.equal(sqlInjection.status, 200);
      t.equal(normalAdd.status, 200);
      t.match(
        stdout,
        /AIKIDO: Zen is disabled\. Configure one of the following environment variables to enable it: AIKIDO_BLOCK, AIKIDO_TOKEN, AIKIDO_DEBUG/
      );
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
