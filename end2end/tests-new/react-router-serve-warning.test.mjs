import { spawn } from "child_process";
import { resolve } from "path";
import { test } from "node:test";
import { fail, match } from "node:assert";
import { timeout } from "./utils/timeout.mjs";

const appDir = resolve(
  import.meta.dirname,
  "../../sample-apps/react-router-serve"
);
const bin = resolve(appDir, "node_modules/.bin/react-router-serve");

test("it warns when @react-router/serve is used", async () => {
  const server = spawn(bin, ["./build/server/index.js"], {
    cwd: appDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      NODE_OPTIONS: "-r @aikidosec/firewall/instrument",
    },
  });

  server.on("error", (err) => {
    fail(`Failed to start subprocess: ${err}`);
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  await timeout(3000);

  match(stderr, /@react-router\/serve/);
  match(stderr, /not supported yet/);

  server.kill();
});
