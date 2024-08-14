const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");
const { connect } = require("http2");

const pathToApp = resolve(__dirname, "../../sample-apps/http2", "index.js");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

t.test("it blocks in blocking mode", (t) => {
  console.log("Running test 1");
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, "4002"], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
  });

  server.on("close", () => {
    console.log("Close 1");
    t.end();
  });

  server.on("error", (err) => {
    console.log(err);
    t.fail(err.message);
  });

  let stdout = "";
  server.stdout.on("data", (data) => {
    console.log(data.toString());
    stdout += data.toString();
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    console.log(data.toString());
    stderr += data.toString();
  });

  // Wait for the server to start
  timeout(2000)
    .then(() => {
      return Promise.all([
        fetch(
          "https://127.0.0.1:4002?url=https://www.cloudflare.com/favicon.ico"
        ),
        fetch("https://127.0.0.1:4002?url=http://localhost"),
      ]);
    })
    .then(([nonSSRF, ssrf]) => {
      console.log("Then");
      t.equal(nonSSRF.status, 200);
      t.equal(ssrf.status, 500);
      t.match(stdout, /Starting agent/);
      t.match(
        stderr,
        /Aikido firewall has blocked a server-side request forgery/
      );
    })
    .catch((error) => {
      console.log(error);
      t.fail(error.message);
    })
    .finally(() => {
      console.log("Finally 1");
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  console.log("Running test 2");
  const server = spawn(`node`, ["--preserve-symlinks", pathToApp, "4003"], {
    env: { ...process.env, AIKIDO_DEBUG: "true" },
  });

  server.on("close", () => {
    console.log("Close 2");
    t.end();
  });

  let stdout = "";
  server.stdout.on("data", (data) => {
    console.log(data.toString());
    stdout += data.toString();
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    console.log(data.toString());
    stderr += data.toString();
  });

  // Wait for the server to start
  timeout(2000)
    .then(() =>
      Promise.all([
        fetch(
          "https://127.0.0.1:4003?url=https://www.cloudflare.com/favicon.ico"
        ),
        fetch("https://127.0.0.1:4003?url=http://localhost"),
      ])
    )
    .then(([nonSSRF, ssrf]) => {
      console.log("Then 2");
      t.equal(nonSSRF.status, 200);
      t.equal(ssrf.status, 500);
      t.match(stdout, /Starting agent/);
      t.notMatch(
        stderr,
        /Aikido firewall has blocked a server-side request forgery/
      );
      t.match(stderr, /fetch failed/);
    })
    .catch((error) => {
      console.log(error);
      t.fail(error.message);
    })
    .finally(() => {
      console.log("Finally 2");
      server.kill();
    });
});

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = typeof url === "string" ? new URL(url) : url;

    const client = connect(parsedUrl.origin);

    const req = client.request({
      ":path": parsedUrl.pathname + parsedUrl.search,
      ":method": options.method || "GET",
      "content-length": options.body ? Buffer.byteLength(options.body) : 0,
    });

    let respHeaders;
    let resData = "";

    req.on("error", (err) => {
      client.close();
      reject(err);
    });

    req.on("response", (headers, flags) => {
      respHeaders = headers;
    });

    req.on("data", (chunk) => {
      resData += chunk;
    });

    req.on("end", () => {
      client.close();
      resolve({ status: respHeaders[":status"], body: resData });
    });

    if (options.body) {
      req.end(options.body);
    } else {
      req.end();
    }
  });
}
