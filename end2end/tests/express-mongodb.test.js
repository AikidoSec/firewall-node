const t = require("tap");
const { exec } = require("node:child_process");
const { resolve } = require("node:path");
const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mongodb",
  "app.js"
);

t.test("it blocks in blocking mode", (t) => {
  const server = exec(`node ${pathToApp}`, (err, stdout, stderr) => {
    t.match(stdout, /Starting agent/);
    t.match(stderr, /Aikido guard has blocked a NoSQL injection/);
    t.end();
  });

  setTimeout(() => {
    Promise.all([
      fetch("http://localhost:4000/?search[$ne]=null"),
      fetch("http://localhost:4000/?search=title"),
    ])
      .then((results) => {
        const [noSQLInjection, normalSearch] = results;
        t.equal(noSQLInjection.status, 500);
        t.equal(normalSearch.status, 200);
        server.kill();
      })
      .catch((error) => {
        t.fail(error.message);
        server.kill();
      });
  }, 1000);
});

t.test("it does not block in dry mode", (t) => {
  const server = exec(
    `node ${pathToApp}`,
    { env: { ...process.env, AIKIDO_NO_BLOCKING: "true" } },
    (err, stdout, stderr) => {
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Aikido guard has blocked a NoSQL injection/);
      t.end();
    }
  );

  setTimeout(() => {
    Promise.all([
      fetch("http://localhost:4000/?search[$ne]=null"),
      fetch("http://localhost:4000/?search=title"),
    ])
      .then((results) => {
        const [noSQLInjection, normalSearch] = results;
        t.equal(noSQLInjection.status, 200);
        t.equal(normalSearch.status, 200);
        server.kill();
      })
      .catch((error) => {
        t.fail(error.message);
        server.kill();
      });
  }, 1000);
});
