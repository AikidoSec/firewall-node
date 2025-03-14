const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-http-https",
  "app.js"
);

// This sample app contains the following endpoint:
// app.get(
//     "/request",
//     asyncHandler(async (req, res) => {
//       ...
//       const response = await fetch(req.query["url"]);
//       ...
//     })
//   );
// The sample app will be served on port 80 and 443
// We want to check if the agent never blocks requests to itself
// With the special case that HTTP/HTTPS is still allowed
// But requests to other ports are blocked
t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      // Required for self-signed certificates
      // This is to allow the sample app to make insecure requests
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
    },
  });

  // Required for self-signed certificates
  // See fetch(...) calls below
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
  timeout(2000)
    .then(() => {
      return Promise.all([
        fetch(
          `http://localhost/request?url=${encodeURIComponent("https://localhost")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(
          `https://localhost/request?url=${encodeURIComponent("http://localhost")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(
          `http://localhost/request?url=${encodeURIComponent("http://localhost:42313")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
        fetch(
          `https://localhost/request?url=${encodeURIComponent("http://localhost:42313")}`,
          {
            signal: AbortSignal.timeout(5000),
          }
        ),
      ]);
    })
    .then(([safe1, safe2, unsafe1, unsafe2]) => {
      t.equal(safe1.status, 200);
      t.equal(safe2.status, 200);
      t.equal(unsafe1.status, 500);
      t.equal(unsafe2.status, 500);
      t.match(stdout, /Starting agent/);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
