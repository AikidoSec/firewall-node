const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const waitOn = require("../waitOn");
const getFreePort = require("../getFreePort");
const { setTimeout } = require("timers/promises");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mongodb",
  "app.js"
);

t.setTimeout(60000);

t.test("it blocks in blocking mode", (t) => {
  const port = getFreePort(t);
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, port], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
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
  waitOn(port)
    .then(() => {
      return Promise.all([
        fetch(`http://127.0.0.1:${port}/?search[$ne]=null`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://127.0.0.1:${port}/?search=title`, {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([noSQLInjection, normalSearch]) => {
      t.equal(noSQLInjection.status, 500);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Zen has blocked a NoSQL injection/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  const port = getFreePort(t);
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, port], {
    env: { ...process.env, AIKIDO_DEBUG: "true" },
  });

  server.on("close", () => {
    t.end();
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
  waitOn(port)
    .then(() =>
      Promise.all([
        fetch(`http://127.0.0.1:${port}/?search[$ne]=null`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://127.0.0.1:${port}/?search=title`, {
          signal: AbortSignal.timeout(5000),
        }),
      ])
    )
    .then(([noSQLInjection, normalSearch]) => {
      t.equal(noSQLInjection.status, 200);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Zen has blocked a NoSQL injection/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it blocks in blocking mode (with open telemetry enabled)", (t) => {
  const port = getFreePort(t);
  const server = spawn(
    `node`,
    [
      "--preserve-symlinks",
      "--require",
      "@opentelemetry/auto-instrumentations-node/register",
      pathToApp,
      port,
    ],
    {
      cwd: resolve(__dirname, "../../sample-apps/express-mongodb"),
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCKING: "true",
        OTEL_TRACES_EXPORTER: "console",
        OTEL_METRICS_EXPORTER: "console",
        OTEL_LOGS_EXPORTER: "console",
        OTEL_NODE_ENABLED_INSTRUMENTATIONS: "http,mongodb",
      },
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

  // Wait for the server to start
  waitOn(port)
    .then(() => {
      return Promise.all([
        fetch(`http://127.0.0.1:${port}/?search[$ne]=null`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://127.0.0.1:${port}/?search=title`, {
          signal: AbortSignal.timeout(5000),
        }),
        setTimeout(4000),
      ]);
    })
    .then(([noSQLInjection, normalSearch]) => {
      t.equal(noSQLInjection.status, 500);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /mongodb\.find/);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Zen has blocked a NoSQL injection/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill("SIGINT");
    });
});

t.test("it does not block in dry mode (with open telemetry enabled)", (t) => {
  const port = getFreePort(t);
  const server = spawn(
    `node`,
    [
      "--preserve-symlinks",
      "--require",
      "@opentelemetry/auto-instrumentations-node/register",
      pathToApp,
      port,
    ],
    {
      cwd: resolve(__dirname, "../../sample-apps/express-mongodb"),
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        OTEL_TRACES_EXPORTER: "console",
        OTEL_METRICS_EXPORTER: "console",
        OTEL_LOGS_EXPORTER: "console",
        OTEL_NODE_ENABLED_INSTRUMENTATIONS: "http,mongodb",
      },
    }
  );

  server.on("close", () => {
    t.end();
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
  waitOn(port)
    .then(() =>
      Promise.all([
        fetch(`http://127.0.0.1:${port}/?search[$ne]=null`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://127.0.0.1:${port}/?search=title`, {
          signal: AbortSignal.timeout(5000),
        }),
        setTimeout(4000),
      ])
    )
    .then(([noSQLInjection, normalSearch]) => {
      t.equal(noSQLInjection.status, 200);
      t.equal(normalSearch.status, 200);
      t.match(stdout, /mongodb\.find/);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Zen has blocked a NoSQL injection/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill("SIGINT");
    });
});
