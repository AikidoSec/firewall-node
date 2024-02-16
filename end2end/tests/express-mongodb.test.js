const t = require("tap");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mongodb",
  "app.js"
);

async function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

t.test("it blocks in blocking mode", async () => {
  const server = spawn(`node`, [pathToApp], { shell: true });

  let stdout = "";
  server.stdout.on("data", (data) => {
    stdout += data.toString();
    console.log("stdout", data.toString());
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
    console.log("stderr", data.toString());
  });

  // Wait for the server to start
  await timeout(1000);

  try {
    const [noSQLInjection, normalSearch] = await Promise.all([
      fetch("http://localhost:4000/?search[$ne]=null", {
        signal: AbortSignal.timeout(5000),
      }),
      fetch("http://localhost:4000/?search=title", {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    t.equal(noSQLInjection.status, 500);
    t.equal(normalSearch.status, 200);
    t.match(stdout, /Starting agent/);
    t.match(stderr, /Aikido guard has blocked a NoSQL injection/);
  } catch (error) {
    t.fail(error.message);
  } finally {
    await new Promise((resolve) => {
      server.kill();
      server.on("close", resolve);
    });
  }
});

t.test("it does not block in dry mode", async () => {
  const server = spawn(`node`, [pathToApp], {
    env: { ...process.env, AIKIDO_NO_BLOCKING: "true" },
    shell: true,
  });

  let stdout = "";
  server.stdout.on("data", (data) => {
    stdout += data.toString();
    console.log("stdout", data.toString());
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
    console.log("stderr", data.toString());
  });

  // Wait for the server to start
  await timeout(1000);

  try {
    const [noSQLInjection, normalSearch] = await Promise.all([
      fetch("http://localhost:4000/?search[$ne]=null", {
        signal: AbortSignal.timeout(5000),
      }),
      fetch("http://localhost:4000/?search=title", {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    t.equal(noSQLInjection.status, 200);
    t.equal(normalSearch.status, 200);
    t.match(stdout, /Starting agent/);
    t.notMatch(stderr, /Aikido guard has blocked a NoSQL injection/);
  } catch (error) {
    t.fail(error.message);
  } finally {
    await new Promise((resolve) => {
      server.kill();
      server.on("close", resolve);
    });
  }
});
