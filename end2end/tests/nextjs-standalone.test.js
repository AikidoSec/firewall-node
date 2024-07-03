const t = require("tap");
const { spawnSync, spawn, execSync } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(__dirname, "../../sample-apps/nextjs-standalone");

t.setTimeout(100000);

t.before(() => {
  const { stderr } = spawnSync(`npm`, ["run", "build"], {
    cwd: pathToApp,
  });

  if (stderr) {
    console.error(stderr.toString());
  }

  const output = execSync(
    `mkdir .next/standalone/node_modules/@aikidosec && cp -r ../../build .next/standalone/node_modules/@aikidosec/firewall`,
    {
      cwd: pathToApp,
    }
  );
});

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(
    `node`,
    [".next/standalone/sample-apps/nextjs-standalone/server.js"],
    {
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCKING: "true",
        PORT: 4000,
        NODE_OPTIONS: "-r @aikidosec/firewall",
      },
      cwd: pathToApp,
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
    console.error(data.toString());
  });

  // Wait for the server to start
  timeout(5000)
    .then((a) => {
      return Promise.all([
        fetch("http://127.0.0.1:4000/files?path=.%27;env%27", {
          method: "GET",
          signal: AbortSignal.timeout(30000),
        }),
        fetch("http://127.0.0.1:4000/files", {
          method: "POST",
          signal: AbortSignal.timeout(30000),
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: `.';env'` }),
        }),
        fetch("http://127.0.0.1:4000/files", {
          method: "GET",
          signal: AbortSignal.timeout(30000),
        }),
        fetch("http://127.0.0.1:4000/cats", {
          method: "POST",
          body: JSON.stringify({ name: "Kitty'); DELETE FROM cats;-- H" }),
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(30000),
        }),
      ]);
    })
    .then(
      ([shellInjectionGet, shellInjectionPost, noInjection, sqlInjection]) => {
        t.equal(shellInjectionGet.status, 500);
        t.equal(shellInjectionPost.status, 500);
        t.equal(noInjection.status, 200);
        t.equal(sqlInjection.status, 500);
        t.match(stdout, /Starting agent/);
        sqlInjection.json().then(console.log);
        console.log(stderr);
        t.match(stderr, /Aikido firewall has blocked a shell injection/);
        t.match(stderr, /Aikido firewall has blocked an SQL injection/);
      }
    )
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  const server = spawn(
    `node`,
    [".next/standalone/sample-apps/nextjs-standalone/server.js"],
    {
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        PORT: 4001,
        NODE_OPTIONS: "-r @aikidosec/firewall",
      },
      cwd: pathToApp,
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
  timeout(5000)
    .then((a) => {
      return Promise.all([
        fetch("http://127.0.0.1:4001/files?path=.%27;env%27", {
          method: "GET",
          signal: AbortSignal.timeout(30000),
        }),
        fetch("http://127.0.0.1:4001/files", {
          method: "GET",
          signal: AbortSignal.timeout(30000),
        }),
        fetch("http://127.0.0.1:4001/cats", {
          method: "POST",
          body: JSON.stringify({ name: "Kitty'); DELETE FROM cats;-- H" }),
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(30000),
        }),
      ]);
    })
    .then(([shellInjection, noInjection, sqlInjection]) => {
      t.equal(shellInjection.status, 200);
      t.equal(noInjection.status, 200);
      t.equal(sqlInjection.status, 200);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Aikido firewall has blocked a shell injection/);
      t.notMatch(stderr, /Aikido firewall has blocked an SQL injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});
