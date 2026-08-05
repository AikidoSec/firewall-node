const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const appDir = resolve(__dirname, "../../sample-apps/react-router-serve");
const bin = resolve(appDir, "node_modules/.bin/react-router-serve");

t.test("it warns when @react-router/serve is used", (t) => {
  const server = spawn(bin, ["./build/server/index.js"], {
    cwd: appDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      NODE_OPTIONS: "-r @aikidosec/firewall/instrument",
    },
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  server.on("error", (err) => {
    t.fail(err.message);
  });

  server.on("close", () => {
    t.match(stderr, /@react-router\/serve/);
    t.match(stderr, /not supported yet/);
    t.end();
  });

  timeout(3000).then(() => server.kill());
});
