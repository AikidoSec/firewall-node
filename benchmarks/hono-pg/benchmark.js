const { readFile, unlink } = require("fs/promises");
const { join } = require("path");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const spawn = require("child_process").spawn;

async function startServer(firewallEnabled) {
  console.log("Spawning server. Firewall enabled:", firewallEnabled);

  let env = { ...process.env };
  if (firewallEnabled) {
    env = {
      ...env,
      AIKIDO_BLOCKING: "true",
      NODE_OPTIONS: "-r @aikidosec/firewall",
    };
  }

  const server = spawn("node", ["--preserve-symlinks", "server.js", "4000"], {
    env,
    cwd: join(__dirname, "app"),
  });

  try {
    server.on("error", (err) => {
      throw err;
    });

    server.on("close", () => {
      console.log("Closing test server...");
    });

    server.stderr.on("data", (data) => {
      throw new Error(data.toString());
    });

    console.log("Waiting for server to start...");
    await new Promise((resolve) => setTimeout(resolve, 2500));

    console.log("Running k6...");
    const result = await exec("k6 run requests.mjs");
    if (result.stderr) {
      throw new Error(result.stderr);
    }

    server.kill();
    // Wait for the server to close
    await new Promise((resolve) => server.on("close", resolve));
  } catch (error) {
    console.error(error);
    return false;
  } finally {
    server.kill();
    return true;
  }
}

async function getResult() {
  const json = await readFile("result.json", "utf8");
  await unlink("result.json");
  return JSON.parse(json);
}

(async () => {
  // Check if k6 is installed
  try {
    await exec("k6 --version");
  } catch (error) {
    console.error(error);
    console.error(
      "k6 is not available. Please install k6 before running this benchmark."
    );
    console.error("https://grafana.com/docs/k6/latest/set-up/install-k6/");
    process.exit(1);
  }

  // Start with firewall enabled
  if (!(await startServer(true))) {
    process.exit(1);
  }

  const resultWithFirewall = await getResult();

  // Start with firewall disabled
  if (!(await startServer(false))) {
    process.exit(1);
  }

  const resultWithoutFirewall = await getResult();

  console.log("====================================");
  console.log("Results with firewall enabled:");
  const customGetFirewall =
    resultWithFirewall.metrics.custom_get_duration.values;
  console.log(
    `GET duration: avg=${customGetFirewall.avg}ms, min=${customGetFirewall.min}ms, max=${customGetFirewall.max}ms`
  );
  const customPostFirewall =
    resultWithFirewall.metrics.custom_post_duration.values;
  console.log(
    `POST duration: avg=${customPostFirewall.avg}ms, min=${customPostFirewall.min}ms, max=${customPostFirewall.max}ms`
  );
  console.log(
    `Total requests: ${resultWithFirewall.metrics.http_reqs.values.count}`
  );

  console.log("------------------------------------");
  console.log("Results with firewall disabled:");
  const customGetNoFirewall =
    resultWithoutFirewall.metrics.custom_get_duration.values;
  console.log(
    `GET duration: avg=${customGetNoFirewall.avg}ms, min=${customGetNoFirewall.min}ms, max=${customGetNoFirewall.max}ms`
  );
  const customPostNoFirewall =
    resultWithoutFirewall.metrics.custom_post_duration.values;
  console.log(
    `POST duration: avg=${customPostNoFirewall.avg}ms, min=${customPostNoFirewall.min}ms, max=${customPostNoFirewall.max}ms`
  );
  console.log(
    `Total requests: ${resultWithoutFirewall.metrics.http_reqs.values.count}`
  );

  const getAvgDiff = customGetFirewall.avg - customGetNoFirewall.avg;
  const postAvgDiff = customPostFirewall.avg - customPostNoFirewall.avg;
  const getDiffPercent = (getAvgDiff / customGetNoFirewall.avg) * 100;
  const postDiffPercent = (postAvgDiff / customPostNoFirewall.avg) * 100;

  console.log("------------------------------------");
  console.log("Firewall performance impact:");
  console.log(`GET avg diff: ${getAvgDiff}ms (${getDiffPercent.toFixed(2)}%)`);
  console.log(
    `POST avg diff: ${postAvgDiff}ms (${postDiffPercent.toFixed(2)}%)`
  );

  // Check if difference is larger than 0.5ms
  if (getAvgDiff > 0.5 || postAvgDiff > 0.5) {
    console.error(
      "Firewall is causing a performance impact thats larger than 0.5ms"
    );
    process.exit(1);
  }

  console.log("Test passed successfully, no significant performance impact.");
  process.exit(0);
})();
