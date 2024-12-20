const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");
const { WebSocket } = require("ws");

const pathToApp = resolve(__dirname, "../../sample-apps/ws-postgres", "app.js");

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4000"], {
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
    .then(async () => {
      // Does not block normal messages
      return await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:4000`);

        ws.on("error", (err) => {
          reject(err);
        });

        ws.on("open", () => {
          ws.send("Hello world!");
        });

        ws.on("message", (data) => {
          const str = data.toString();
          if (str.includes("Welcome")) {
            return;
          }
          t.match(str, /Hello world!/);
          ws.close();
          resolve();
        });
      });
    })
    .then(async () => {
      // Does block sql injection
      return await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:4000`);

        ws.on("error", (err) => {
          reject(err);
        });

        ws.on("open", () => {
          ws.send("Bye'); DELETE FROM messages;--");
        });

        ws.on("message", (data) => {
          const str = data.toString();
          if (
            str.includes("Welcome") ||
            str.includes("Hello") ||
            str.includes("Bye")
          ) {
            return;
          }
          t.match(str, /An error occurred/);
          ws.close();
          resolve();
        });
      });
    })
    .then(() => {
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
  const server = spawn(`node`, [pathToApp, "4001"], {
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
    .then(async () => {
      // Does not block normal messages
      return await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:4001`);

        ws.on("error", (err) => {
          reject(err);
        });

        ws.on("open", () => {
          ws.send("Hello world!");
        });

        ws.on("message", (data) => {
          const str = data.toString();
          if (str.includes("Welcome")) {
            return;
          }
          t.match(str, /Hello world!/);
          ws.close();
          resolve();
        });
      });
    })
    .then(async () => {
      // Does block sql injection
      return await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:4001`);

        ws.on("error", (err) => {
          reject(err);
        });

        ws.on("open", () => {
          ws.send("Bye'); DELETE FROM messages;--");
        });

        ws.on("message", (data) => {
          const str = data.toString();
          if (str.includes("Welcome") || str.includes("Hello")) {
            return;
          }
          t.match(str, /Bye/);
          ws.close();
          resolve();
        });
      });
    })
    .then(() => {
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
