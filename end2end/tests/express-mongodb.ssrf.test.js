const t = require("tap");
const { spawn } = require("child_process");
const { readFile } = require("fs/promises");
const { createServer } = require("http");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-mongodb",
  "app.js"
);

const testServerUrl = "http://localhost:5874";
const safeImage = "https://nodejs.org/static/images/favicons/favicon.png";
const unsafeImage = "http://local.aikido.io:5875/favicon.png";

t.setTimeout(60000);

let server;
t.before(async () => {
  const contents = await readFile(resolve(__dirname, "./fixtures/favicon.png"));

  return new Promise((resolve) => {
    server = createServer((req, res) => {
      if (req.url === "/favicon.png") {
        res.writeHead(200, { "Content-Type": "image/png" });
        res.write(contents);
        res.end();
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end();
      }
    });

    server.listen(5875, () => {
      resolve();
    });

    server.unref();
  });
});

let token;
t.beforeEach(async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  token = body.token;
});

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4000"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_URL: testServerUrl,
    },
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
        fetch(`http://127.0.0.1:4000/images/${encodeURIComponent(safeImage)}`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(
          `http://127.0.0.1:4000/images/${encodeURIComponent(unsafeImage)}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
      ]);
    })
    .then(([safeRequest, ssrfRequest]) => {
      t.equal(safeRequest.status, 200);
      t.equal(ssrfRequest.status, 500);
      t.match(stdout, /Starting agent/);
      t.match(stderr, /Zen has blocked a server-side request forgery/);

      return fetch(`${testServerUrl}/api/runtime/events`, {
        method: "GET",
        headers: {
          Authorization: token,
        },
      });
    })
    .then((response) => {
      return response.json();
    })
    .then((events) => {
      const attacks = events.filter(
        (event) => event.type === "detected_attack"
      );
      t.same(attacks.length, 1);
      const [attack] = attacks;
      t.match(attack.attack.stack, /app\.js/);
      t.match(attack.attack.stack, /fetchImage\.js/);
      t.match(attack.attack.stack, /express-async-handler/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4001"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_URL: testServerUrl,
    },
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
  timeout(2000)
    .then(() =>
      Promise.all([
        fetch(`http://127.0.0.1:4001/images/${encodeURIComponent(safeImage)}`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(
          `http://127.0.0.1:4001/images/${encodeURIComponent(unsafeImage)}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
      ])
    )
    .then(([safeRequest, ssrfRequest]) => {
      t.equal(safeRequest.status, 200);
      t.equal(ssrfRequest.status, 200);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Zen has blocked a server-side request forgery/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.after(async () => {
  server.close();
});
