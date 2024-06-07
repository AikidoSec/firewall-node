const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(__dirname, "../../sample-apps/nextjs-standalone");

t.setTimeout(60000);

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`npm`, ["run", "dev"], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
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
  timeout(2000)
    .then((a) => {
      return Promise.all([
        fetch("http://127.0.0.1:4000/files?path=.%27;cat%20%27./package.json", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://127.0.0.1:4000/files", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: ".';cat './package.json" }),
        }),
        fetch("http://127.0.0.1:4000/files?path=docs", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([shellInjectionGet, shellInjectionPost, noInjection]) => {
      t.equal(shellInjectionGet.status, 500);
      t.equal(shellInjectionPost.status, 500);
      t.equal(noInjection.status, 200);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Aikido runtime has blocked a shell injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  const server = spawn(`npm`, ["run", "dev"], {
    env: { ...process.env, AIKIDO_DEBUG: "true" },
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
  timeout(2000)
    .then((a) => {
      return Promise.all([
        fetch("http://127.0.0.1:4000/files?path=.%27;cat%20%27./package.json", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://127.0.0.1:4000/files?path=docs", {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(([shellInjection, noInjection]) => {
      t.equal(shellInjection.status, 200);
      t.equal(noInjection.status, 200);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Aikido runtime has blocked a shell injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
